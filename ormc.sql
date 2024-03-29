CREATE DATABASE sfdeploymentmgr;

-- Deployment Table
CREATE TABLE deployments (
    deployment_id SERIAL PRIMARY KEY,
    pipeline_id INT NOT NULL,
    artifact_id INT NOT NULL,
    deployment_status VARCHAR(50) NOT NULL,
    deployment_result VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    deployed_at TIMESTAMP WITHOUT TIME ZONE
);

-- Artifact Table
CREATE TABLE artifacts (
    artifact_id SERIAL PRIMARY KEY,
    artifact_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- PullRequest Table
CREATE TABLE pull_requests (
    pullrequest_id SERIAL PRIMARY KEY,
    src_branch_name VARCHAR(255) NOT NULL,  -- Reverted to VARCHAR(255)
    dest_branch_name VARCHAR(255) NOT NULL,  -- Reverted to VARCHAR(255)
    commit_start_hash CHAR(40),
    commit_end_hash CHAR(40),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    merged_at TIMESTAMP WITHOUT TIME ZONE
);

-- ArtifactPullRequest Junction Table (for Many-to-Many relationship)
CREATE TABLE artifact_pull_requests (
    artifact_id INT NOT NULL,
    pullrequest_id INT NOT NULL,
    PRIMARY KEY (artifact_id, pullrequest_id),
    FOREIGN KEY (artifact_id) REFERENCES artifacts(artifact_id) ON DELETE CASCADE,
    FOREIGN KEY (pullrequest_id) REFERENCES pull_requests(pullrequest_id) ON DELETE CASCADE
);

-- Pipeline Table
CREATE TABLE pipelines (
    pipeline_id SERIAL PRIMARY KEY,
    pipeline_name VARCHAR(255) NOT NULL,
    start_pull_request_id INT,
    description TEXT,
    last_run_at TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (start_pull_request_id) REFERENCES pull_requests(pullrequest_id)
);

-- DeploymentStep Table
CREATE TABLE deployment_steps (
    deployment_step_id SERIAL PRIMARY KEY,
    deployment_id INT NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    result VARCHAR(255),
    started_at TIMESTAMP WITHOUT TIME ZONE,
    ended_at TIMESTAMP WITHOUT TIME ZONE,
    log TEXT,
    FOREIGN KEY (deployment_id) REFERENCES deployments(deployment_id) ON DELETE CASCADE
);

-- Indexes (Consider adding indexes based on your query patterns for performance optimization)
CREATE INDEX idx_deployments_deployment_status ON deployments(deployment_status);
CREATE INDEX idx_pull_requests_merged_at ON pull_requests(merged_at);
CREATE INDEX idx_deployment_steps_status ON deployment_steps(status);
