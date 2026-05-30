import prisma from '../config/prisma';

export const getUnreadNotifications = async () => {
  return prisma.notification.findMany({
    where: { read: false },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
};

export const markNotificationRead = async (id: string) => {
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
};
