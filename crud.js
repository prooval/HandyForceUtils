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

  const knex = require('knex')(require('./knexfile')); // Make sure your knex configuration is correct

class ArtifactRepository {
    // Define allowed fields to update
    allowedUpdateFields = ['name', 'description', 'category']; // Add more fields as needed

    async updateArtifact(artifactId, updateData) {
        // Sanitize and filter fields
        const dataToUpdate = {};
        this.allowedUpdateFields.forEach(field => {
            if (updateData.hasOwnProperty(field) && updateData[field] != null) {
                dataToUpdate[field] = updateData[field];
            }
        });

        // Check if there are fields to update
        if (Object.keys(dataToUpdate).length === 0) {
            return { message: 'No valid fields provided for update', updated: false };
        }

        // Perform the update
        await knex('artifacts').where({ id: artifactId }).update(dataToUpdate);

        // Return the updated artifact
        const updatedArtifact = await knex('artifacts').where({ id: artifactId }).first();
        return { ...updatedArtifact, updated: true };
    }
}

module.exports = ArtifactRepository;

const knex = require('knex')(require('./knexfile'));  // Adjust the path as necessary

class Deployments {
    static async getAllDeploymentsGroupedByArtifact() {
        try {
            // Get all artifacts with their deployments and pull requests
            const artifactsData = await knex('artifacts')
                .select([
                    'artifacts.id as artifactId',
                    'artifacts.name as artifactName',
                    'deployments.id as deploymentId',
                    'deployments.name as deploymentName',
                    'deployments.date as deploymentDate',
                    'pull_requests.id as prId',
                    'pull_requests.title as prTitle',
                    'pull_requests.date as prDate'
                ])
                .leftJoin('deployments', 'deployments.artifact_id', 'artifacts.id')
                .leftJoin('pull_requests', 'pull_requests.artifact_id', 'artifacts.id')
                .orderBy('artifacts.id');

            // Transform the flat data into nested JSON
            const result = artifactsData.reduce((acc, item) => {
                let artifact = acc.find(a => a.artifactId === item.artifactId);
                if (!artifact) {
                    artifact = {
                        artifactId: item.artifactId,
                        artifactName: item.artifactName,
                        deployments: [],
                        pullRequests: []
                    };
                    acc.push(artifact);
                }
                if (item.deploymentId && !artifact.deployments.find(d => d.deploymentId === item.deploymentId)) {
                    artifact.deployments.push({
                        deploymentId: item.deploymentId,
                        deploymentName: item.deploymentName,
                        deploymentDate: item.deploymentDate
                    });
                }
                if (item.prId && !artifact.pullRequests.find(pr => pr.prId === item.prId)) {
                    artifact.pullRequests.push({
                        prId: item.prId,
                        prTitle: item.prTitle,
                        prDate: item.prDate
                    });
                }
                return acc;
            }, []);

            return result;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }
}

module.exports = Deployments;

