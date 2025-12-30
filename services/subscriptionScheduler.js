const userService = require('./userService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

function startScheduler() {
  const run = async () => {
    try {
      const now = new Date();

      const makeDayRange = (date) => {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      };

      // 7 days warning
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { start: s7, end: e7 } = makeDayRange(sevenDays);
      const users7 = await userService.getUsersWithNextBillingDateOn(s7, e7);
      for (const user of users7) {
        const warned = user.subscription?.warningsSent?.sevenDay;
        if (!warned) {
          try {
            await notificationService.notifyUser(
              user.email,
              user.firstName,
              'subscription_7day_warning',
              null,
              { type: user.subscription?.type || 'premium' }
            );
            if (user.gender === 'female' && user.guardianEmail) {
              await notificationService.notifyGuardian(
                user.guardianEmail,
                user.firstName,
                'subscription_7day_warning',
                null,
                { type: user.subscription?.type || 'premium' }
              );
            }
            await userService.updateUser(user._id, {
              subscription: {
                ...user.subscription,
                warningsSent: {
                  ...(user.subscription?.warningsSent || {}),
                  sevenDay: true,
                },
              },
            });
          } catch (e) {
            logger.warn(`Failed 7-day warn for user ${user._id}: ${e.message}`);
          }
        }
      }

      // 3 days warning
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const { start: s3, end: e3 } = makeDayRange(threeDays);
      const users3 = await userService.getUsersWithNextBillingDateOn(s3, e3);
      for (const user of users3) {
        const warned = user.subscription?.warningsSent?.threeDay;
        if (!warned) {
          try {
            await notificationService.notifyUser(
              user.email,
              user.firstName,
              'subscription_3day_warning',
              null,
              { type: user.subscription?.type || 'premium' }
            );
            if (user.gender === 'female' && user.guardianEmail) {
              await notificationService.notifyGuardian(
                user.guardianEmail,
                user.firstName,
                'subscription_3day_warning',
                null,
                { type: user.subscription?.type || 'premium' }
              );
            }
            await userService.updateUser(user._id, {
              subscription: {
                ...user.subscription,
                warningsSent: {
                  ...(user.subscription?.warningsSent || {}),
                  threeDay: true,
                },
              },
            });
          } catch (e) {
            logger.warn(`Failed 3-day warn for user ${user._id}: ${e.message}`);
          }
        }
      }

      // Expiry today (billing day)
      const today = now;
      const { start: st, end: et } = makeDayRange(today);
      const usersToday = await userService.getUsersWithNextBillingDateOn(st, et);
      for (const user of usersToday) {
        const warned = user.subscription?.warningsSent?.expiryDay;
        if (!warned) {
          try {
            await notificationService.notifyUser(
              user.email,
              user.firstName,
              'subscription_expiry_today',
              null,
              { type: user.subscription?.type || 'premium' }
            );
            if (user.gender === 'female' && user.guardianEmail) {
              await notificationService.notifyGuardian(
                user.guardianEmail,
                user.firstName,
                'subscription_expiry_today',
                null,
                { type: user.subscription?.type || 'premium' }
              );
            }
            await userService.updateUser(user._id, {
              subscription: {
                ...user.subscription,
                warningsSent: {
                  ...(user.subscription?.warningsSent || {}),
                  expiryDay: true,
                },
              },
            });
          } catch (e) {
            logger.warn(`Failed expiry-day warn for user ${user._id}: ${e.message}`);
          }
        }
      }

      logger.info(
        `Subscription scheduler tick complete: 7-day=${users7.length}, 3-day=${users3.length}, today=${usersToday.length}`
      );
    } catch (err) {
      logger.error(`Subscription scheduler error: ${err.message}`);
    }
  };

  // Run immediately on startup then hourly
  run();
  setInterval(run, 60 * 60 * 1000);
  logger.info('Subscription scheduler started (hourly).');
}

module.exports = { startScheduler };
