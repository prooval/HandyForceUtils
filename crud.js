const Deployments = {
    async create({ pipeline_id, artifact_id }) {
      const [newDeployment] = await knex('deployments').insert({
        pipeline_id,
        artifact_id,
        deployment_status: 'New', // Default status
        created_at: new Date() // Automatically set the creation time
      }).returning('*');
      return newDeployment;
    },
    async updateStatus(deploymentId, deployment_status, deployment_result) {
      const [updatedDeployment] = await knex('deployments').where({ deployment_id: deploymentId }).update({
        deployment_status,
        deployment_result,
        updated_at: new Date() // Automatically update the timestamp
      }, '*');
      return updatedDeployment;
    }
  };

  const Artifacts = {
    async create({ artifact_name }) {
      const [newArtifact] = await knex('artifacts').insert({
        artifact_name,
        created_at: new Date() // Automatically set the creation time
      }).returning('*');
      return newArtifact;
    }
  };

  const PullRequests = {
    async create({ src_branch_name, dest_branch_name, commit_start_hash, commit_end_hash }) {
      const [newPullRequest] = await knex('pull_requests').insert({
        src_branch_name,
        dest_branch_name,
        commit_start_hash,
        commit_end_hash,
        created_at: new Date() // Set when the PR is created
      }).returning('*');
      return newPullRequest;
    },
    async markAsMerged(pullRequestId) {
      const [updatedPullRequest] = await knex('pull_requests').where({ pullrequest_id: pullRequestId }).update({
        merged_at: new Date() // Set when the PR is merged
      }, '*');
      return updatedPullRequest;
    }
  };

  const Pipelines = {
    async create({ pipeline_name, description }) {
      const [newPipeline] = await knex('pipelines').insert({
        pipeline_name,
        description
        // Note: start_pull_request_id might be set later as it depends on specific workflows
      }).returning('*');
      return newPipeline;
    }
  };

  const DeploymentSteps = {
    async create(deploymentId, { step_name }) {
      const [newStep] = await knex('deployment_steps').insert({
        deployment_id: deploymentId,
        step_name,
        status: 'Pending', // Default to Pending on creation
        started_at: new Date() // Automatically set the start time
      }).returning('*');
      return newStep;
    },
    async updateStepStatus(deploymentStepId, status, result) {
      const [updatedStep] = await knex('deployment_steps').where({ deployment_step_id: deploymentStepId }).update({
        status,
        result,
        ended_at: new Date() // Automatically set when updating the status
      }, '*');
      return updatedStep;
    }
  };

  