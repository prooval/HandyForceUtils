// Path: /routes/deploymentRoutes.js
const express = require('express');
const router = express.Router();
const knex = require('../db/knex'); // Ensure Knex configuration is correctly set up

router.get('/api/deployments', async (req, res) => {
    try {
        const rawData = await knex('Deployments')
            .join('ArtifactPullRequest', 'Deployments.artifact_id', '=', 'ArtifactPullRequest.artifact_id')
            .join('Artifacts', 'Artifacts.artifact_id', '=', 'Deployments.artifact_id')
            .join('PullRequests', 'PullRequests.pullrequest_id', '=', 'ArtifactPullRequest.pullrequest_id')
            .select(
                'Deployments.*', 
                'Artifacts.artifact_name',
                'PullRequests.pullrequest_id',
                'PullRequests.src_branch_name',
                'PullRequests.dest_branch_name',
                'PullRequests.commit_start_hash',
                'PullRequests.commit_end_hash',
                'PullRequests.created_at as pr_created_at',
                'PullRequests.merged_at'
            );

        const transformedData = rawData.reduce((acc, row) => {
            if (!acc[row.deployment_id]) {
                acc[row.deployment_id] = {
                    deployment: {
                        deployment_id: row.deployment_id,
                        pipeline_id: row.pipeline_id,
                        artifact_id: row.artifact_id,
                        status: row.status,
                        result: row.result,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        deployed_at: row.deployed_at
                    },
                    artifact: {
                        artifact_id: row.artifact_id,
                        artifact_name: row.artifact_name
                    },
                    pull_requests: []
                };
            }

            acc[row.deployment_id].pull_requests.push({
                pullrequest_id: row.pullrequest_id,
                src_branch_name: row.src_branch_name,
                dest_branch_name: row.dest_branch_name,
                commit_start_hash: row.commit_start_hash,
                commit_end_hash: row.commit_end_hash,
                created_at: row.pr_created_at,
                merged_at: row.merged_at
            });

            return acc;
        }, {});

        res.json(Object.values(transformedData));
    } catch (error) {
        console.error('Error fetching deployments:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
