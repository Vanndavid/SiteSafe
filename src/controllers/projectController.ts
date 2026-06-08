import { Request, Response } from 'express';
import { getRequestUserId } from '../utils/authUtils';
import { createProject, deleteProject, listProjectsForUser, updateProject } from '../services/projectService';

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

export const editProjectHandler = async (req: Request, res: Response) => {
  // Implementation for editing a project will go here
  const projectId = parseInt(req.params.id?.toString() || '');
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  const userId = getRequestUserId(req);
  const { name, description } = req.body || {};

  updateProject(userId, projectId, {
    name:  name ,
    description: description , 
  }).then((updatedProject) => {
    res.json({ project: updatedProject });
  }).catch((error) => {
    console.error('Failed to edit project:', error);
    res.status(500).json({ error: 'Failed to edit project' });
  });
};

export const deleteProjectHandler = async (req: Request, res: Response) => {
  // Implementation for deleting a project will go here
  const projectId = parseInt(req.params.id?.toString() || '');
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  const userId = getRequestUserId(req);

  deleteProject(userId, projectId).then(() => {
    res.status(204).send();
  }).catch((error) => {
    console.error('Failed to delete project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  });  
};

