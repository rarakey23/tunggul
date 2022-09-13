module.exports = function(Job) {
  Job.observe("before save", function(ctx, next) {
    if (ctx.isNewInstance && ctx.instance) {
      ctx.instance.created = new Date();
      ctx.instance.userId = ctx.instance.userId || ctx.options.ctx.userId;
      ctx.instance.createdBy = ctx.options.ctx.userId;
      if (ctx.instance.userName) {
        var AppUser = loopback.getModelByType("AppUser");
        var filter = {
          where: {
            username: ctx.instance.userName
          }
        };
        AppUser.findOne(filter, ctx.options, function(err, user) {
          if (!user) {
            return next();
          }
          ctx.instance.userId = user.id;
          next();
        });
      } else {
        next();
      }
    } else {
      next();
    }
  });
};
