import prisma from '../config/prisma';

export type CreateProjectInput = {
  name: string;
  description: string;
};

export const listProjectsForUser = async (userId: string) => {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });
};

export const createProject = async (userId: string, input: CreateProjectInput) => {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Project name is required');
  }

  return prisma.project.create({
    data: {
      name,
      description: input.description?.trim() || null,
      userId,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });
};

export const getProjectForUser = async (userId: string, projectId: number) => {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
};
