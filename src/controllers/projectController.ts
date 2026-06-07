import { Request, Response } from 'express';
import { getRequestUserId } from '../utils/authUtils';
import { createProject, listProjectsForUser } from '../services/projectService';

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const projects = await listProjectsForUser(userId);
    res.json({ projects });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const createProjectHandler = async (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const { name, description } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await createProject(userId, {
      name,
      description: typeof description === 'string' ? description : "",
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};
