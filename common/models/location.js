loopback = require('loopback');

module.exports = function locFn(Location) {
	Location.observe('before save', function locBeforeSaveFn(ctx, next) {
		if(ctx.instance && ctx.options.ctx.username) {
			ctx.instance.username = ctx.options.ctx.username;
		}
		if (ctx.isNewInstance) {
			ctx.instance.created = new Date();
			ctx.instance.userId = ctx.instance.userId || ctx.options.ctx.userId;
			ctx.instance.name = ctx.instance.name || ctx.options.ctx.username;
			ctx.instance.createdBy = ctx.options.ctx.userId;
	   }

		if(ctx.instance && ctx.instance.loc) {
			coords = (ctx.instance.loc).split(",");
			ctx.instance.latitude = Number(coords[0]);
			ctx.instance.longitude = Number(coords[1]);
			ctx.instance.loc = undefined;
		}
		next();
	});


	// Location.observe('after save', function locAfterSaveFn(ctx, next) {
	// 	if(ctx.instance) {
	// 		console.log("Location after save: sending data", JSON.stringify(ctx.instance));
	// 		var sockets = Location.app.skts;
	// 		sockets.forEach(function(socket) {
	// 			socket.emit('message1', ctx.instance);
	// 		});
			
	// 	}
	// 	next();
	// });

	Location.observe('after save', function(ctx, next) {
		if(ctx.instance && ctx.instance.userId) {
				// if (ctx.instance.private == true) {
				// 	return next();
				// }
				if (ctx.instance.accuracy ) {
				var UserInfoModel = loopback.getModelByType("UserInfo");
				var filter = {where : {id : ctx.instance.userId}};
        		UserInfoModel.findOne(filter, ctx.options, function(err, userInfo) {
						var now = new Date();
						// GPS has a delay of more than 60 seconds
						var locationTime = ctx.instance.locationTime;
						if (now.getTime() - locationTime <= 90000) {
							locationTime = now.getTime();
						}
						if (userInfo) {
							userInfo.updateAttributes({
								lastUpdateTime : now,
								latitude: ctx.instance.latitude,
								longitude : ctx.instance.longitude,
								accuracy : ctx.instance.accuracy,
								lastLocationTime : locationTime,
								name : ctx.instance.name,
								provider : ctx.instance.provider 
							}, ctx.options, function(err, dbresult){
								console.log('update of userinfo ', err, dbresult.name);
								// ignore error  
								next();
							});
						}
						else {
							UserInfoModel.create({
								id : ctx.instance.userId,
								lastLocationTime : locationTime,
								latitude: ctx.instance.latitude,
								lastUpdateTime : now,
								longitude : ctx.instance.longitude,
								name : ctx.options.ctx.username,
								accuracy : ctx.instance.accuracy,
								provider : ctx.instance.provider 
							}, ctx.options, function(err, dbresult){
								console.log('userinfo created ', err, dbresult.name);
								next();
							});
							
						}
					
			  	});
			} else {
				next();
			}
		} else {
			next();
		}
	});

	Location.remoteMethod('loc', {
		description: 'Sets new location from a Google Maps URL',
		accessType: 'READ',
		accepts: [{
		  arg: 'url',
		  type: 'string',
		  description: 'url',
		  http: {
			source: 'query'
		  }
		}
		],
		http: {
		  verb: 'GET',
		  path: '/loc'
		},
		returns: {
		  type: 'object',
		  root: true
		}
	  });


	  Location.loc = function loc(url, options, cb) {
		var data = {};
		if (!cb && typeof options === 'function') {
		  cb = options;
		  options = {};
		}
		var firstIndexOfComma = url.indexOf(",", url.indexOf("@"));
		var secondIndexOfComma = url.indexOf(",", 2 + firstIndexOfComma);
		var latlng = url.substring(1 + url.indexOf("@"), secondIndexOfComma);
		var name = url.substring(0, url.indexOf("/"));
		if(name.startsWith("http")) name = "UNNAMED";
		var lat = Number(latlng.substring(0, latlng.indexOf(',')));
		var lng = Number(latlng.substring(1 + latlng.indexOf(',')));
		var tm = new Date().getTime()/1000;
		var type = "URL";
		var data = {"time": tm, "latitude": lat, "longitude": lng, "name": name, "type": type};
		Location.upsert(data, options.ctx, function upd(err, data) {
			cb(err, data);
		  });
		};
		

		Location.remoteMethod('deletebyname', {
			description: 'Deletes Locations with specified Name',
			accessType: 'WRITE',
			accepts: [{
				arg: 'name',
				type: 'string',
				description: 'name to be deleted',
				http: {
				source: 'query'
				}
			}
			],
			http: {
				verb: 'GET',
				path: '/deletebyname'
			},
			returns: {
				type: 'object',
				root: true
			}
			});
	
	
			Location.deletebyname = function loc(name, options, cb) {
				if(!name) return cb("No name was specified", null);
				Location.remove({name: name}, options.ctx, function del(err, data) {
					cb(err, data);
					refreshClients();
				});
			};

			Location.remoteMethod('deletelastlocation', {
				description: 'Deletes last Location for specified Name',
				accessType: 'WRITE',
				accepts: [{
					arg: 'name',
					type: 'string',
					description: 'name whose last location is to be deleted',
					http: {
					source: 'query'
					}
				}
				],
				http: {
					verb: 'GET',
					path: '/deletelastlocation'
				},
				returns: {
					type: 'object',
					root: true
				}
				});
		
		
				Location.deletelastlocation = function loc(name, options, cb) {
					if(!name) return cb("No name was specified", null);
					Location.findOne({where: {name: name}, order: 'time DESC', limit: 1}, options.ctx, function del(err, data) {
						if(data && data.id) {
							Location.remove({id: data.id}, options.ctx, function del(err, data) {
								refreshClients();
									return cb(err, data);
							});
					  } else {
							return cb(err, data);
						}
					});
				};
	
        function refreshClients() {
					var sockets = Location.app.skts;
					sockets.forEach(function(socket) {
						socket.emit('refresh', {});
					});
				}

}
