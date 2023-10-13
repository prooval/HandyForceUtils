#!/bin/bash

# Initialize variables
PR_ID=$1  # Pull Request ID passed as an argument
LOG_DIR="./logs/$PR_ID"
SERVICE_PORTAL_DIR="./service-portal"

# Create log directory if it doesn't exist
mkdir -p $LOG_DIR

# Function for logging
log_message() {
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$TIMESTAMP: $1" | tee -a "$LOG_DIR/task1_log.txt"
}

# Error function
handle_error() {
    log_message "Error: $1"
    exit 1
}

# Function to get the branch name based on PR_ID
get_branch_name() {
    log_message "Fetching branch name for PR ID $PR_ID."
  
    # Replace YOUR_BITBUCKET_URL, YOUR_PROJECT, and YOUR_REPO with your specific Bitbucket details
    BITBUCKET_URL="YOUR_BITBUCKET_URL"
    PROJECT="YOUR_PROJECT"
    REPO="YOUR_REPO"
  
    # Fetch the pull request details
    # You may need to include authentication details in this curl command
    PR_DETAILS=$(curl -s "$BITBUCKET_URL/rest/api/1.0/projects/$PROJECT/repos/$REPO/pull-requests/$PR_ID")
  
    # Use jq to parse the JSON and get the branch name
    BRANCH_NAME=$(echo $PR_DETAILS | jq -r '.fromRef.id')
  
    if [ -z "$BRANCH_NAME" ]; then
        handle_error "Could not fetch the branch name for PR ID $PR_ID."
    else
        log_message "Successfully fetched branch name: $BRANCH_NAME."
        echo $BRANCH_NAME
    fi
}

# Function to pull the branch
pull_branch() {
    BRANCH_NAME=$1
    log_message "Pulling the branch $BRANCH_NAME."
  
    cd $SERVICE_PORTAL_DIR || handle_error "Failed to change directory to $SERVICE_PORTAL_DIR."
    git pull origin $BRANCH_NAME || handle_error "Git pull failed for branch $BRANCH_NAME."
  
    log_message "Successfully pulled $BRANCH_NAME."
}

# Function to run sfgd command
run_sfgd() {
    BRANCH_NAME=$1
    log_message "Running sfgd command from develop to $BRANCH_NAME."
  
    # Switch to develop branch
    git checkout develop || handle_error "Failed to checkout develop branch."
  
    # Run sfgd command
    sfdx sgd:source:delta --to $BRANCH_NAME --from "develop" --output . || handle_error "Failed to run sfgd command."
  
    log_message "Successfully ran sfgd command."
}

# Execution starts here
log_message "------- Starting Task I Script -------"

# Step 1: Get branch name
BRANCH_NAME=$(get_branch_name) || handle_error "Fetching branch name failed."

# Step 2: Pull the branch
pull_branch $BRANCH_NAME

# Step 3: Run sfgd command
run_sfgd $BRANCH_NAME

log_message "------- Task I Script Ended -------"
