#! /bin/bash

set -u

function usage() {
    cat << EOF
deploy [options] <disk>:<zone>...
Options:
    -n <max-number-of-snapshots>
    -l <label-prefix>
    -t <topic-prefix>
    -s <scheduler-prefix>
    -z <timezone>
EOF
}

max_number_of_snapshots=5
label_prefix=""
topic_prefix="gcp-vm-pubsub"
scheduler_prefix="gcp-vm-scheduler"
time_zone=""
OPTIND=1
while getopts hn:l:t:z: OPT
do
    case $OPT in
        n) 
            max_number_of_snapshots=$OPTARG
            ;;
        l)
            label_prefix=$OPTARG
            ;;
        t)
            topic_prefix=$OPTARG
            ;;
        s)
            scheduler_prefix=$OPTARG
            ;;
        z)
            time_zone=$OPTARG
            ;;
        \?) 
            usage
            exit
            ;;
    esac
done
shift $((OPTIND - 1))

echo "-------"
echo "max_number_of_snapshots: $max_number_of_snapshots"
echo "label_prefix           : $label_prefix"
echo "topic_prefix           : $topic_prefix"
echo "scheduler_prefix       : $scheduler_prefix"
echo "time_zone              : $time_zone"
echo "disks                  : $@"
echo "-------"

DISK_ARRAY="["
for disk in $@
do
    name=$(echo $disk | cut -f 1 -d ":")
    zone=$(echo $disk | cut -f 2 -d ":")
    DISK_ARRAY+="[\"${name}\", \"${zone}\"],"
done
DISK_ARRAY="${DISK_ARRAY%,}]"

# Create Pub/Sub topic
gcloud pubsub topics create ${topic_prefix}__delete_disk
gcloud pubsub topics create ${topic_prefix}__delete_snapshot

# Deploy functions
npm run build
cp ./out/src/main.js index.js
gcloud functions deploy deleteDiskPubSub \
    --trigger-topic ${topic_prefix}__delete_disk \
    --runtime nodejs8
gcloud functions deploy removeOldSnapshotsPubSub \
    --trigger-topic ${topic_prefix}__delete_snapshot \
    --runtime nodejs8

# Create Scheduler
TIME_ZONE_FLAG=""
if [ ! "$time_zone" = "" ]
then
    TIME_ZONE_FLAG="--time-zone ${time_zone}"
fi
LABEL_PREFIX=""
if [ ! "$label_prefix" = "" ]
then
    LABEL_PREFIX=",\"labelPrefix\":\"${label_prefix}\""
fi
gcloud beta scheduler jobs create pubsub \
    ${scheduler_prefix}__delete_disk_job \
    --schedule="0 1 * * *" \
    --topic=${topic_prefix}__delete_disk \
    --message-body="{\"disks\":$DISK_ARRAY}" \
    ${TIME_ZONE_FLAG}
gcloud beta scheduler jobs create pubsub \
    ${scheduler_prefix}__delete_snapshot_job \
    --schedule="* 3 * * *" \
    --topic=${topic_prefix}__delete_snapshot \
    --message-body="{\"disks\":$DISK_ARRAY,\"maxNumOfSnapshots\":${max_number_of_snapshots}${LABEL_PREFIX}}" \
    ${TIME_ZONE_FLAG}
