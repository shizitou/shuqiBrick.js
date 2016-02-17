/*
	TODO::
	comboUrl的配置
	数据的sessionStorage缓存的处理
	fastClick的嵌入
	UICompenent嵌入
	数据视图绑定（大工程）
**/
(function(global, undefined) {
	'use strict';
	var moduleCache = {};
	var modCore = {
		version: '3.0.0',
		configs: {
			timeout: 15, // 请求模块的最长耗时
			paths: {}, // 模块对应的路径
			deplist: {}, // 依赖配置表
			comboUrl: null, // function (ids) { return url; }
			combo: false, //是否启用combo
			baseUrl: "", // 后面用来拼接path作为完整请求地址
			maxUrlLength: 2000 // 拼接combo地址时,请求url的最大长度
		}
	};
	//关键节点config defined filterMids
	var mounts = {
		list: {},
		add: function(node,fn){
			this.list[node] = typeof fn === 'function' ? fn : null ;
		},
		remove: function(node){
			delete this.list[node];
		},
		dispatch: function(node,args/*array*/){
			var handle = this.list[node];
			if(handle && !handle.fire){
				handle.fire = true;
				var res = handle.apply(modCore,args);
				handle.fire = false;
				return res;
			}
		}
	};
	//这是给brick的框架使用的
	var appConfig = {};
	var deplistChange = false;
	var coreConfig = modCore.configs;
	var DOMCACHE = 'brick'+new Date().getTime();
	var localStorage = global.localStorage;
	var hashKey = '_BRICK_HASH';
	// 获取模块在配置中对应的别名
	function parsePaths(id) {
		var paths = coreConfig.paths;
		return paths && type(paths[id])==='string' ? paths[id] : id;
	}
	var STATUS = {
		// 2 - 请求成功，执行了define来进行存储模块
		SAVED: 2,
		// 3 - 模块正在被解析
		EXECUTING: 3,
		// 4 - 模块已经解析完毕
		EXECUTED: 4
	}
	function define(id, deps, factory) {
		//处理参数
		var argsLen = arguments.length;
		// define(factory)
		if (argsLen === 1) {
			factory = id
			id = undefined
		} else if (argsLen === 2) {
			factory = deps
			// define(deps, factory)
			if (type(id)=== 'array') {
				deps = id
				id = undefined
			}
			// define(id, factory)
			else {
				deps = [];
			}
		}
		if(id){
			var mod = Module.get(id);
			// 当mod模块还未被保存的时候将其保存,
			if (mod.status < STATUS.SAVED) {
				mod.dependencies = deps || [];
				mod.factory = factory;
				mod.status = STATUS.SAVED;
				mounts.dispatch('defined',[id,deps,factory]);
			}
		}
	};
	define.mount = function(node,handle){
		mounts.add(node,handle);
		return this;
	};
	define.unmount = function(node){
		mounts.remove(node);
		return this;
	};
	//接收要加载模块的ID集合
	define.load = (function() {
		var doc = document;
		var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement;
		var baseElement = head.getElementsByTagName("base")[0];
		function filter(arr,filters){
			for(var i=arr.length;i>=0;i--){
				if(filters.length){
					for(var j=filters.length;j>=0;j--){
						if(filters[j]===arr[i]){
							arr.splice(i,1);
							filters.splice(j,1);
						}
					}
				}else{
					break;
				}
			}
			return arr;
		}
		return function(ids,loaded) {
			//过滤这些id不触发加载逻辑
			var filterIds = mounts.dispatch('filterMids',[ids]);
			ids = filter(ids, filterIds || []);
			if(!ids.length){
				setTimeout(loaded,4);
				return ;
			}
			console.log('loadModules: ',ids);
			var queryUrl = Module.genUrl(ids);
			var node = doc.createElement("script");
			var tid = setTimeout(function(){
				clearTimeout(tid);
				nodeHandle('TIMEOUT');
			}, (coreConfig.timeout || 15) * 1000);
			node.async = true;
			node.src = queryUrl;
			if ('onload' in node) {
				node.onload = function() {
					clearTimeout(tid);
					nodeHandle('LOAD');
				};
			} else {
				node.onreadystatechange = function() {
					if (/loaded|complete/.test(this.readyState)) {
						clearTimeout(tid);
						nodeHandle('UNKNOW');
					}
				};
			}
			node.onerror = function() {
				clearTimeout(tid);
				nodeHandle('ERROR');
			};
			//插入DOM
			baseElement ?
				head.insertBefore(node, baseElement) :
				head.appendChild(node);
			//status: LOAD, ERROR, TIMEOUT, UNKNOW
			function nodeHandle(status) {
				loaded();
				head.removeChild(node);
			}
		};
	})();
	function Module(modId) {
		this.id = modId;
		// css,js
		this.fileType = '';
		this.dependencies = [];
		this.factory = undefined;
		this.exports = undefined;
		//onload的监听函数
		this.loaded = [];
		//模块的状态
		this.status = 0;
	}
	Module.prototype.init = function(){
		//取出真实路径
		this.fileType = fileType(parsePaths(this.id)) || 'js' ;
	};
	//添加加载完毕后触发的操作列表
	Module.prototype.onload = function(onload) {
		this.loaded.push(onload);
	};
	//执行模块得到exports
	Module.prototype.exec = function() {
		var mod = this,
			factory,
			exports;
		// 执行过了则不需要再次执行
		if (mod.status >= STATUS.EXECUTING) {
			return mod.exports
		}
		function require(id) {
			return Module.get(id).exec();
		}
		require.async = function(ids, callback) {
			modCore.use.apply(modCore, arguments);
			return require;
		}
		//加载失败的时候
		if(mod.factory===undefined){
			exports = undefined;
		// Exec factory
		}else{
			mod.status = STATUS.EXECUTING;
			factory = mod.factory;
			exports = type(factory)==='function' ?
				factory(require, mod.exports = {}, mod) :
				factory;
			// 当模块体是函数时,将执行后赋值在模块exports的接口赋值给exports变量
			// 如果函数没有返回任何东西，只是执行的话，则赋值{}
			if (exports === undefined) {
				exports = mod.exports;
			}
			mod.status = STATUS.EXECUTED;
			mod.exports = exports;
			// 执行完毕删除模块对函数体的引用
			delete mod.factory;
		}
		return exports;
	};
	//加载完毕后来触发,这里需要解析自身模块的依赖关系到关系表中,并触发自身的回调
	Module.prototype.load = function(){
		//当factory不为空时,解析自身parse
		if(this.factory)
			this.dependencies.length && this.parseDepend();
		each(this.loaded, function(load){
			load();
		});
	}
	Module.prototype.parseDepend = function(){
		// array
		var depend = this.dependencies,
			deplist = coreConfig.deplist,
			self = this.id,
			// string, array, null
			selfDep = deplist[self],
			depsLn,i;
		if(!selfDep || type(selfDep)==='string'){
			selfDep = deplist[self] = selfDep ? [selfDep] : [] ;
		}
		depsLn = selfDep.length;
		each(depend,function(newDep){
			var isSame = false;
			for(i=0;i<depsLn;i++){
				if(selfDep[i]===newDep){
					isSame = true;
					break;
				}
			}
			if(!isSame){
				deplistChange = true;
				selfDep.push(newDep);
			}
		});
	}
	//获取模块,这里会进行缓存
	Module.get = function(modId) {
		var module = moduleCache[modId]
		if(!module){
			module = moduleCache[modId] = new Module(modId);
			module.init();
		}
		return module;
	};
	//使用模块
	// modules: []
	Module.use = function(modules, callback) {
		//处理依赖列表
		var depModules = Module.getDeps(modules),
			waiting = 0,
			fetchModules = [];
		each(depModules, function(module) {
			//处理模块加载，以及为模块加载设置回调
			if (module.status < STATUS.SAVED) {
				module.onload(function() {
					if (--waiting === 0) {
						callback(depModules);
					}
				});
				fetchModules[waiting++] = module;
			}
		});
		if( fetchModules.length ){
			Module.fetch(fetchModules);
		}else{
			callback(depModules);
		}
	};
	//获取模块的所有依赖模块列表
	Module.getDeps = function(modIds) {
		var needModules = {},
			deplist = coreConfig.deplist;
		each(modIds, function(modId) {
			//添加模块到需要加载的列表中
			//如果是有缓存的话,这里会将modId模块中的依赖直接解析到依赖表中
			pushToNeed(modId);
			//查询出当前模块的依赖模块列表
			each(getDepsModule(modId), function(modId) {
				//添加模块到需要加载的列表中
				pushToNeed(modId);
			});
		});
		return needModules;

		//return [] || null;
		function getDepsModule(modId) {
			var result = [],
				deps;
			// []
			if (deps = deplist[modId]) {
				result = type(deps) === 'string' ? [deps] : deps ;
				for (var i = 0, j = deps.length; i < j; i++) {
					result = result.concat(getDepsModule(deps[i]));
				}
			}
			return result;
		}

		function pushToNeed(modId) {
			if (!needModules[modId]) {
				needModules[modId] = Module.get(modId);
			}
		}
	};
	//加载模块
	Module.fetch = function(loadModules) {
		var config = coreConfig,
			comboModels;
		//合并加载
		if (config.combo) {
			comboModels = {
				'js': [],
				'css': []
			};
			each(loadModules, function(mod) {
				comboModels[mod.fileType].push(mod);
			});
			each(['css', 'js'], function(type) {
                var urlLength = 0,
                    ids = [];
                each(comboModels[type], function(res, i) {
                	var idLength = res.id.length;
                    if (urlLength + idLength < config.maxUrlLength) {
                        urlLength += idLength;
                        ids.push(res.id);
                    } else {
                        urlLength = idLength;
                        ids = [res.id];
                    }
                    if (i === comboModels[type].length - 1) {
                        fetch(ids);
                    }
                });
            });
		//一般加载
		} else {
			each(loadModules,function(mod){
				fetch([mod.id]);
			});
		}
		function fetch(ids) {
			define.load(ids.slice(0),function(){
				each(ids, function(modId){
					moduleCache[modId].load();
				});
			});
		}
	};
	Module.genUrl = function(ids){
        var ids = [].concat(ids),
        	config = coreConfig,
            url = config.combo && config.comboUrl || config.baseUrl;
       	each(ids,function(id,i){
       		id = parsePaths(id);
       		if( fileType(id) !== 'js' ){
       			id = id + '.js';
       		}
       		ids[i] = id;
       	});
       	url = type(url) === 'function' ? 
       		url(ids) :
       		~url.indexOf('%s') ? 
       			url.replace('%s', ids.join(',')) : 
       			url+ids.join(',') ;
       	//防止浏览器缓存，请求时带上hash
        return url + (~url.indexOf('?') ? '&' : '?') + '_hash=' + config.hash;
	}
	/******* 对外接口 *******/
	//配置
	modCore.config = function(obj) {
		var options = coreConfig;
		each(obj, function(value, key) {
			var t = type(value);
			if (t === 'object' || t === 'array') {
				//如果配置中初始化的就是对象的话
				value = JSON.parse(JSON.stringify(value));
			};
			options[key] = value;
		});
		// detect _debug=nocombo in location.search
		if (/\b_debug=([\w,]+)\b/.test(location.search)) {
			if(RegExp.$1.indexOf('nocombo'))
				options.combo = false;
		}
		mounts.dispatch('config');
	};
	//使用模块 (mod1,mod2[,fn]); ([mod1,mod2],fn);
	modCore.use = function() {
		var needModulesId,callback;
		needModulesId = [].concat.apply([],arguments);
		callback = needModulesId[needModulesId.length-1];
		callback = type(callback) === 'function' ?
			needModulesId.pop() :
			null;
		Module.use(needModulesId, process);
		//这里只是经过
		function process(){
			/*
				当经历过千山万苦在回到这里的时候,
				早有的记忆可能已经改变,
				无奈你需要重回起点，再次拾起那“遗失的记忆”
			********/
			if(deplistChange){
				deplistChange = false;
				Module.use(needModulesId, process);
			}else{
				finalHandle();
			}
		}
		//最终走到这里
		function finalHandle(){
			var exports = [];
			each(needModulesId, function(moduleId, i) {
				exports[i] = moduleCache[moduleId].exec();
			});
			callback && callback.apply(global, exports);
		}
	};
	//扩展属性
	modCore.extend = function(obj,objExt){
		if(objExt===undefined){
			objExt = obj;
			obj = this;	
		}
		for(var n in objExt){
			if(objExt.hasOwnProperty(n) && !obj[n] ){
				obj[n] = objExt[n];
			}
		}
	};
	modCore.require = function(id){
		return Module.get(id).exec()
	}
	define('$insertCSS', function(){
		return function(cssStr){
			var node = document.createElement('style');
 	        node.appendChild(document.createTextNode(cssStr));
 	        document.head.appendChild(node);
		};
	});

	global.define = define;
	global.module = modCore;

	/******* 工具函数 *******/
	function each(obj, iterator, context) {
		if(!obj) return ;
		var i, l, t = type(obj);
		context = context || obj;
		if (t === 'array') {
			for (i = 0, l = obj.length; i < l; i++) {
				if (iterator.call(context, obj[i], i, obj) === false)
					return;
			}
		} else {
			for (i in obj) {
				if (obj.hasOwnProperty(i)) {
					if (iterator.call(context, obj[i], i, obj) === false)
						return;
				}
			}
		}
	}
	function type(obj) {
		var t;
		if (obj == null) {
			t = String(obj);
		} else {
			t = Object.prototype.toString.call(obj).toLowerCase();
			t = t.substring(8, t.length - 1);
		}
		return t;
	}
	var TYPE_RE = /\.(js|css)(?=[?&,]|$)/i;
	function fileType(str) {
		var ext;
		str.replace(TYPE_RE, function(m, $1) {
			ext = $1;
		});
		return ext;
	}
})(this);