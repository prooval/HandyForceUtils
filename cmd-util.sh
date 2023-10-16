#!/bin/bash

execute_task_i_validate() {
    PR_ID=$1
    # Your code for the validate operation here
    echo "Validating for PR ID: $PR_ID"
}

execute_task_i_deploy() {
    PR_ID=$1
    # Your code for the deploy operation here
    echo "Deploying for PR ID: $PR_ID"
}

# Check for minimum number of arguments
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 (--validate|--deploy) <Pull_Request_ID>"
    exit 1
fi

OPERATION=$1
PR_ID=$2

# Check the operation type
case $OPERATION in
    --validate)
        execute_task_i_validate $PR_ID
        ;;
    --deploy)
        execute_task_i_deploy $PR_ID
        ;;
    *)
        echo "Invalid operation. Use --validate or --deploy."
        exit 1
        ;;
esac
