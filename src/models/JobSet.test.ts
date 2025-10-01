import { JobSet } from './JobSet';
import { JobStatus } from '../types';

describe('JobSet', () => {
  describe('Constructor', () => {
    it('should create JobSet with provided data', () => {
      const data = {
        id: 'jobset-123',
        jobs: [
          {
            id: 'job-1',
            status: 'completed',
            results: {
              raw: { url: 'https://example.com/raw.jpg', type: 'image' },
              min: { url: 'https://example.com/min.jpg', type: 'image' }
            }
          }
        ]
      };

      const jobSet = new JobSet(data);

      expect(jobSet.id).toBe('jobset-123');
      expect(jobSet.jobs).toHaveLength(1);
      expect(jobSet.jobs[0].id).toBe('job-1');
      expect(jobSet.jobs[0].status).toBe('completed');
    });
  });

  describe('Status Properties', () => {
    it('should return true for isCompleted when all jobs are completed', () => {
      const jobSet = new JobSet({
        id: 'jobset-123',
        jobs: [
          { id: 'job-1', status: JobStatus.COMPLETED },
          { id: 'job-2', status: JobStatus.COMPLETED }
        ]
      });

      expect(jobSet.isCompleted).toBe(true);
    });

    it('should handle NSFW status', () => {
      const jobSet = new JobSet({
        id: 'jobset-123',
        jobs: [
          { id: 'job-1', status: JobStatus.NSFW }
        ]
      });

      expect(jobSet.isCompleted).toBe(false);
    });
  });

  describe('Job Results', () => {
    it('should preserve job results', () => {
      const results = {
        raw: { url: 'https://example.com/raw.jpg', type: 'image' },
        min: { url: 'https://example.com/min.jpg', type: 'image' }
      };

      const jobSet = new JobSet({
        id: 'jobset-123',
        jobs: [
          {
            id: 'job-1',
            status: JobStatus.COMPLETED,
            results
          }
        ]
      });

      expect(jobSet.jobs[0].results).toEqual(results);
    });

    it('should handle null results', () => {
      const jobSet = new JobSet({
        id: 'jobset-123',
        jobs: [
          {
            id: 'job-1',
            status: JobStatus.IN_PROGRESS,
            results: null
          }
        ]
      });

      expect(jobSet.jobs[0].results).toBeNull();
    });

    it('should handle undefined results', () => {
      const jobSet = new JobSet({
        id: 'jobset-123',
        jobs: [
          {
            id: 'job-1',
            status: JobStatus.QUEUED
          }
        ]
      });

      expect(jobSet.jobs[0].results).toBeUndefined();
    });
  });
});