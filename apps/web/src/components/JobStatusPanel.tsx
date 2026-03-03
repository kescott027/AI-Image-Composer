import { useCallback, useEffect, useMemo, useState } from "react";

import { listJobs, type JobRead } from "../api/jobs";

interface JobStatusPanelProps {
  sceneId: string;
  refreshIntervalMs?: number;
}

function formatDateTime(timestamp?: string | null): string {
  if (!timestamp) {
    return "n/a";
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleString();
}

function sortRecentFirst(left: JobRead, right: JobRead): number {
  const leftValue = left.created_at ? Date.parse(left.created_at) : 0;
  const rightValue = right.created_at ? Date.parse(right.created_at) : 0;
  return rightValue - leftValue;
}

function JobItem({ job }: { job: JobRead }) {
  return (
    <li className="job-item">
      <div className="job-main">
        <strong>{job.job_type}</strong>
        <span>{job.id}</span>
      </div>
      <p>Status: {job.status}</p>
      <p>Created: {formatDateTime(job.created_at)}</p>
      {job.error ? <p className="job-error">Error: {job.error}</p> : null}
      {job.output_artifact_ids.length > 0 ? (
        <div className="job-artifacts">
          {job.output_artifact_ids.map((artifactId) => (
            <a
              key={artifactId}
              href={`/api/artifacts/${artifactId}`}
              target="_blank"
              rel="noreferrer"
              className="mini-button"
            >
              Artifact {artifactId}
            </a>
          ))}
        </div>
      ) : null}
      {job.logs.length > 0 ? (
        <details className="job-logs">
          <summary>Logs ({job.logs.length})</summary>
          <ul>
            {job.logs.map((entry, index) => (
              <li key={`${job.id}_${index}`}>{entry}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

export function JobStatusPanel({ sceneId, refreshIntervalMs = 5000 }: JobStatusPanelProps) {
  const [jobs, setJobs] = useState<JobRead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const refreshJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listJobs({ sceneId });
      setJobs(result);
      setErrorMessage(null);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load jobs";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [sceneId]);

  useEffect(() => {
    void refreshJobs();
    const interval = window.setInterval(() => {
      void refreshJobs();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshJobs, refreshIntervalMs]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "QUEUED" || job.status === "RUNNING").sort(sortRecentFirst),
    [jobs],
  );
  const completedJobs = useMemo(
    () => jobs.filter((job) => job.status === "SUCCEEDED" || job.status === "CANCELED").sort(sortRecentFirst),
    [jobs],
  );
  const failedJobs = useMemo(
    () => jobs.filter((job) => job.status === "FAILED").sort(sortRecentFirst),
    [jobs],
  );

  return (
    <section className="job-status-panel">
      <div className="job-status-header">
        <h3>Job Queue</h3>
        <button type="button" className="mini-button" onClick={() => void refreshJobs()} disabled={isLoading}>
          Refresh
        </button>
      </div>
      <p>
        Active: {activeJobs.length} | Completed: {completedJobs.length} | Failed: {failedJobs.length}
      </p>
      <p className="job-status-meta">
        {isLoading ? "Loading jobs..." : `Last updated: ${formatDateTime(lastUpdatedAt)}`}
      </p>
      {errorMessage ? <p className="job-error">Failed to fetch jobs: {errorMessage}</p> : null}

      <h4>Active Jobs</h4>
      {activeJobs.length === 0 ? (
        <p className="job-empty">No active jobs.</p>
      ) : (
        <ul className="job-list">
          {activeJobs.map((job) => (
            <JobItem key={job.id} job={job} />
          ))}
        </ul>
      )}

      <h4>Completed Jobs</h4>
      {completedJobs.length === 0 ? (
        <p className="job-empty">No completed jobs.</p>
      ) : (
        <ul className="job-list">
          {completedJobs.map((job) => (
            <JobItem key={job.id} job={job} />
          ))}
        </ul>
      )}

      <h4>Failed Jobs</h4>
      {failedJobs.length === 0 ? (
        <p className="job-empty">No failed jobs.</p>
      ) : (
        <ul className="job-list">
          {failedJobs.map((job) => (
            <JobItem key={job.id} job={job} />
          ))}
        </ul>
      )}
    </section>
  );
}
