async function checkForUndeployedPRsAndDeploy() {
    // Ensure no deployments are currently "In Progress"
    const ongoing = await knex('deployments').where('deployment_status', 'In Progress').first();
    if (ongoing) {
      console.log("A deployment is currently in progress. Waiting for the next interval.");
      return;
    }
  
    // Fetch merged PRs that have not been deployed yet
    const undeployedPRs = await knex('pull_requests as pr')
      .leftJoin('artifact_pull_requests as apr', 'pr.pullrequest_id', 'apr.pullrequest_id')
      .leftJoin('artifacts as art', 'apr.artifact_id', 'art.artifact_id')
      .leftJoin('deployments as dep', 'art.artifact_id', 'dep.artifact_id')
      .select('pr.pullrequest_id', 'pr.src_branch_name', 'pr.dest_branch_name', 'pr.commit_end_hash')
      .where('pr.merged_at', '!=', null)
      .andWhere(function() {
        this.where('dep.deployment_status', '!=', 'Completed')
        .orWhereNull('dep.deployment_status');
      })
      .groupBy('pr.pullrequest_id')
      .orderBy('pr.merged_at', 'asc');
  
    if (undeployedPRs.length === 0) {
      console.log("No new merged PRs to deploy.");
      return;
    }
  
    // Group PRs for deployment
    // This is a simplified placeholder. Your logic might involve determining which PRs
    // need to be grouped together based on their dependencies or the issues they fix.
    const prGroup = undeployedPRs.slice(0, 2); // Example: Taking the first two PRs for deployment
  
    console.log(`Initiating deployment for PRs: ${prGroup.map(pr => `#${pr.pullrequest_id}`).join(', ')}`);
    try {
      await initiateDeploymentForPRs(prGroup);
      console.log("Deployment successful for grouped PRs.");
      // Mark PRs as deployed in your database logic here
    } catch (error) {
      console.error("Deployment failed for grouped PRs. Will retry with additional PRs next time.", error);
      // Handle failed deployment, possibly marking these PRs for re-attempt or logging the failure
    }
  }
  
  async function initiateDeploymentForPRs(prGroup) {
    // Your deployment logic here
    // This should include the actual steps to deploy the grouped PRs together
    // For simplicity, this is a placeholder function
    return new Promise((resolve, reject) => {
      // Simulate deployment logic
      setTimeout(() => {
        // Simulate a possible deployment failure
        const success = Math.random() > 0.5;
        if (success) resolve();
        else reject(new Error("Simulated deployment failure"));
      }, 1000);
    });
  }
  