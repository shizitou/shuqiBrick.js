//负责解析hash，监听hash的改变
define('$router', ['$controller','$util', '$config'], function(require) {
	'use strict';
	var config = require('$config'),
		control = require('$controller'),
		utilMod = require('$util'),
		util = utilMod.collection,
		//是否支持h5的state事件啊
		monitorMode = !!(window.onpopstate) ? 'popstate' : 'hashchange';
	
	function Router() {};
	var proto = {
		start: function() {
			if (Router.isStart)
				return;
			Router.isStart = true;
			//默认控制器
			this.defControl = config.defController;
			control.init();
			//获取当前路由碎片
			this.fragment = util.getFragment()
			var that = this;
			//hash发生改变时触发
			function checkUrl() {
				var pageHash = util.getFragment(),
					hash;
				if (pageHash !== that.fragment) {
					hash = pageHash;
				}
				if (hash !== void 0) {
					that.fragment = hash;
					that.fireRouteChange(hash);
				}
			}
			switch (monitorMode) {
				case 'popstate':
					window.addEventListener('popstate', checkUrl);
					break;
				case 'hashchange':
					window.addEventListener('hashchange', checkUrl);
					break;
			}
			BK.trigger('afterRun');
			//DOM加载完毕后触发第一次的加载
			this.fireRouteChange(this.fragment);
			//TODO 缺少对页面A标签的监听
		},
		fireRouteChange: function(hash) {
			var option = {
				formUser: Router.fromUser
			};
			Router.fromUser = undefined;
			var con = this.parseHash(hash);
			control.firePageControl(con[0],con[1],option);
		},
		parseHash: function(hash){
			//返回 'ct.ac' 和 解析后的parse参数
			var controller = '',
				params = util.parseHash(hash);
			if(params['ct'] && params['ac']){
				controller = params['ct']+params['ac'];
				// params['__page'] = controller;
				delete params['ct'],delete params['ac'];
			}else if(this.defControl){
				controller = this.defControl;
			}
			return [controller,params];
		}
	};
	Router.prototype = proto;

	utilMod
		// $.link('ct/ac',{})
		.set('link', function(page, params) {
			Router.fromUser = true;
			window.location.hash = '!/' + this.genPHash(page, params);
		})
		// commend: 'replace','push'
		.set('history', function(commend, page, params) {
			window['history'][commend + 'State']({}, '', '#!/' + this.genPHash(page, params));
		})

		
	//将收集到的util绑定到brick开放给外部
	return new Router;
});