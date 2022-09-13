
module.exports = function(UserRegistration) {
    
    // Till we enable security, assume valid user
    // TODO implement generate OTP and verification process
    UserRegistration.observe("after save", function(ctx, next) {
        var UserModel = loopback.getModelByType("User");
        var options = ctx.options;
        var username = ctx.instance.name.toLowerCase();
        var filter = {
            where : {
                name : username
            }
        };
        UserModel.findOne(filter, options, function(err, dbuser) {
            if (dbuser) {
                UserModel.login(ctx.instance, options, next);
                dbuser.updateAttributes(
                    {
                      deviceToken: ctx.instance.deviceToken
                    },
                    options, function(err) {
                        if (err) {
                            console.log('Error in update deviceToken ', err);
                        } else {
                            console.log('deviceToken updated');
                        }
                    });
            }
            else { 
                var data = {
                    username : username,
                    email : ctx.instance.email,
                    phone : ctx.instance.phone,
                    deviceToken : ctx.instance.deviceToken,
                    password : ctx.instance.password
                };
                UserModel.create(data, options, function(err, dbuser) {
                    if (err) {
                        return next(err);
                    }
                    if (dbuser) {
                        UserModel.login(ctx.instance, options, next);
                    } else {
                        return next();
                    }
                });
            };
        });
    });
  };
    