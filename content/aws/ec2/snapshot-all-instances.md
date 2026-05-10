---
title: Snapshot every EC2 instance with AMIs
aliases: [backup all ec2, ami backup all instances, ec2 ami snapshot script]
tags: [type/recipe, tech/aws, tech/ec2]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/recipes/index]]"
  - "[[aws/ec2/index]]"
  - "[[aws/kms/index]]"
  - "[[aws/rds/index]]"
  - "[[aws/account-migrations]]"
  - "[[aws/rds/cross-account-snapshot]]"
  - "[[aws/ec2/ami-cross-account-copy]]"
source:
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/creating-an-ami-ebs.html
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/deregister-ami.html
  - https://docs.aws.amazon.com/cli/latest/reference/ec2/create-image.html
  - https://docs.aws.amazon.com/cli/latest/reference/ec2/run-instances.html
---

> Take a manual point-in-time backup of every EC2 instance in an account by creating one AMI per instance. AMIs (root volume + boot config + all attached EBS) make the instance redeployable from a single image ID; bare EBS snapshots only restore data, not the machine.

## When to use AMI vs raw EBS snapshot

| Primitive                         | Captures                                                                                         | Restore unit                               | Use when                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------- |
| AMI (`create-image`)              | Root volume + all attached EBS + boot config (kernel, ENA (Elastic Network Adapter) flags, arch) | Launch a new instance with `run-instances` | You want to redeploy the _machine_ later     |
| EBS snapshot (`create-snapshots`) | Only the EBS volumes attached to the instance                                                    | Create volumes you attach to an instance   | You only care about the _data_, not the boot |

For "save state of every instance, restore at any moment", use AMIs. The recipe below is the AMI path.

> [!warning] `--no-reboot` and file-system consistency
> By default, `create-image` powers the instance down before snapshotting so volumes are quiesced (writes flushed and paused so the on-disk state is consistent). Passing `--no-reboot` (or unchecking _Reboot instance_ in the console) skips that step: there is no downtime, but AWS [explicitly does not guarantee file-system integrity](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/creating-an-ami-ebs.html) of the resulting image. Stateless app servers usually tolerate this; for databases either stop the instance first OR rely on the database's own backup mechanism (e.g. [[aws/rds/index|RDS]] snapshot, `pg_basebackup`).

## Recipe

Replace `PROFILE` and `REGION` with the active CLI profile and target region.

### 1. Snapshot every instance in one pass

Uses [`aws ec2 create-image`](https://docs.aws.amazon.com/cli/latest/reference/ec2/create-image.html) once per instance, tagging both the AMI and the underlying snapshots so they're easy to find later.

```bash
export AWS_PROFILE=PROFILE
export AWS_REGION=REGION
STAMP=$(date +%Y%m%d-%H%M%S)

aws ec2 describe-instances \
  --query 'Reservations[].Instances[].[InstanceId,Tags[?Key==`Name`]|[0].Value]' \
  --output text \
| while read -r ID NAME; do
    NAME=${NAME:-$ID}
    SAFE=$(echo "$NAME" | tr -c '[:alnum:]-_' '-')
    echo "Snapshotting $ID ($NAME)..."
    aws ec2 create-image \
      --instance-id "$ID" \
      --name "backup-${SAFE}-${STAMP}" \
      --description "Manual backup of $NAME ($ID) on $STAMP" \
      --no-reboot \
      --tag-specifications \
        "ResourceType=image,Tags=[{Key=Backup,Value=manual-${STAMP}},{Key=SourceInstance,Value=${ID}},{Key=SourceName,Value=${NAME}}]" \
        "ResourceType=snapshot,Tags=[{Key=Backup,Value=manual-${STAMP}},{Key=SourceInstance,Value=${ID}}]"
  done
```

What this gives you:

- One AMI per instance, named `backup-<instance-name>-<timestamp>`.
- Underlying EBS snapshots are created and tagged automatically by `--tag-specifications` (separate `image` and `snapshot` resource types).
- `describe-instances` returns running AND stopped instances by default; pass `--filters Name=instance-state-name,Values=running` to scope to running only.

### 2. Wait for the AMIs to become `available`

AMI creation is async: `State` goes `pending` → `available`, taking minutes per gigabyte of volume.

```bash
aws ec2 describe-images --owners self \
  --filters "Name=tag:Backup,Values=manual-${STAMP}" \
  --query 'Images[].[ImageId,Name,State,CreationDate]' --output table

aws ec2 wait image-available \
  --filters "Name=tag:Backup,Values=manual-${STAMP}"
```

### 3. Restore (any moment later)

Find the AMI by source name, then launch a new instance from it with [`aws ec2 run-instances`](https://docs.aws.amazon.com/cli/latest/reference/ec2/run-instances.html):

```bash
aws ec2 describe-images --owners self \
  --filters "Name=tag:SourceName,Values=<original-name>" \
  --query 'Images[].[ImageId,Name,CreationDate]' --output table

aws ec2 run-instances \
  --image-id ami-xxxxxxxx \
  --instance-type t3.medium \
  --subnet-id subnet-xxxx \
  --security-group-ids sg-xxxx \
  --key-name your-key
```

The new instance is a fresh resource with a new ID, private/public IP, and ENIs (elastic network interfaces: the virtual NICs attached to the instance). Elastic IP associations, target-group registrations (the load-balancer pool the instance belongs to), and Route 53 A records do NOT come back automatically; reattach them.

> [!info] Encrypted volumes
> If any source volume was encrypted with a [[aws/kms/index|KMS]] key, the AMI's snapshots stay encrypted with that same key. The launching account/role needs `kms:Decrypt` on the key to start instances from the AMI; for cross-account restore, see [[aws/rds/cross-account-snapshot|cross-account snapshot]].

## Cleanup

Manual AMIs and their snapshots live forever until you remove them. Deregistering an AMI does NOT delete its snapshots ([per the deregister-ami docs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/deregister-ami.html)): you keep paying for storage until both are gone.

```bash
AMI=ami-xxxxxxxx
SNAPS=$(aws ec2 describe-images --image-ids $AMI \
  --query 'Images[].BlockDeviceMappings[].Ebs.SnapshotId' --output text)
aws ec2 deregister-image --image-id $AMI
for s in $SNAPS; do aws ec2 delete-snapshot --snapshot-id $s; done
```

Bulk cleanup of a tagged batch:

```bash
aws ec2 describe-images --owners self \
  --filters "Name=tag:Backup,Values=manual-${STAMP}" \
  --query 'Images[].ImageId' --output text \
| tr '\t' '\n' \
| while read AMI; do
    SNAPS=$(aws ec2 describe-images --image-ids $AMI \
      --query 'Images[].BlockDeviceMappings[].Ebs.SnapshotId' --output text)
    aws ec2 deregister-image --image-id $AMI
    for s in $SNAPS; do aws ec2 delete-snapshot --snapshot-id $s; done
  done
```

## Cost notes

- AMIs themselves are free; you pay for the EBS snapshots underneath at standard EBS snapshot pricing.
- Snapshots are incremental against prior snapshots of the same volume, so a second backup of an unchanged instance is cheap; the FIRST snapshot of each volume is full size.
- `--no-reboot` does not change cost; the storage is the same either way.

## When to graduate to AWS Backup

This recipe is the right primitive for ad-hoc, "before-I-touch-anything" backups. For recurring policy (daily snapshots, retention windows, lifecycle to cold storage, cross-region or cross-account copy), use **AWS Backup** with an EC2 backup plan instead: same underlying snapshots, but pruning and retention are managed for you. AWS Backup-managed AMIs cannot be deregistered through EC2; you delete the recovery point (AWS Backup's name for one stored snapshot) in the backup vault instead.
