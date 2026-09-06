import prisma from '../config/prisma';

export const getUnreadNotifications = async () => {
  return prisma.notification.findMany({
    where: { read: false },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
};

export const markNotificationRead = async (id: string) => {
  const notificationId = Number(id);

  if (!Number.isInteger(notificationId)) {
    throw new Error('Invalid notification id');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
};
