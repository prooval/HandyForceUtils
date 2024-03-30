const knex = require('../db/knex'); // Adjust the path based on your project structure

class DeploymentService {
  async findPRsWithoutSuccessfulDeployment() {
    return knex('pullrequests as pr')
      .leftJoin('artifactpullrequest as apr', 'pr.pullrequest_id', 'apr.pullrequest_id')
      .leftJoin('deployment as d', 'apr.artifact_id', 'd.artifact_id')
      .select('pr.*')
      .whereNull('d.result')
      .orWhere('d.result', '!=', 'Deployment successful')
      .groupBy('pr.pullrequest_id')
      .having(knex.raw('COUNT(d.deployment_id) = 0 OR SUM(CASE WHEN d.result = \'Deployment successful\' THEN 1 ELSE 0 END) = 0'));
  }
}

/**
   * Filters the lastMerged array to find PRs that match the IDs of PRs without successful deployments.
   * Then, combines these PRs into an artifact for deployment.
   * 
   * @param {Array} lastMerged - Array of PR objects from the Bitbucket API.
   * @param {Array} undeployedPRs - Array of PR IDs without successful deployments.
   * @returns {Array} - Array of PRs from lastMerged that need to be deployed.
   */
prepareDeploymentArtifact(lastMerged, undeployedPRs) {
    const prIdsToDeploy = undeployedPRs.map(pr => pr.pullrequest_id); // Assuming pullrequest_id is the key
    const prsForDeployment = lastMerged.filter(pr => prIdsToDeploy.includes(pr.id));

    // Here, we simply return the filtered PRs.
    // You might want to further process these into a 'deployment artifact' object based on your deployment logic.
    return prsForDeployment;
}

