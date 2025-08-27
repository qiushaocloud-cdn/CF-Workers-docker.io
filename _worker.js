// _worker.js

// Docker镜像仓库主机地址
let hub_host = 'registry-1.docker.io';
// Docker认证服务器地址
const auth_url = 'https://auth.docker.io';

let 屏蔽爬虫UA = ['netcraft'];

// 根据主机名选择对应的上游地址
function routeByHosts(host) {
	// 定义路由表
	const routes = {
		// 生产环境
		"quay": "quay.io",
		"gcr": "gcr.io",
		"k8s-gcr": "k8s.gcr.io",
		"k8s": "registry.k8s.io",
		"ghcr": "ghcr.io",
		"cloudsmith": "docker.cloudsmith.io",
		"nvcr": "nvcr.io",

		// 测试环境
		"test": "registry-1.docker.io",
	};

	if (host in routes) return [routes[host], false];
	else return [hub_host, true];
}

/** @type {RequestInit} */
const PREFLIGHT_INIT = {
	// 预检请求配置
	headers: new Headers({
		'access-control-allow-origin': '*', // 允许所有来源
		'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS', // 允许的HTTP方法
		'access-control-max-age': '1728000', // 预检请求的缓存时间
	}),
}

/**
 * 构造响应
 * @param {any} body 响应体
 * @param {number} status 响应状态码
 * @param {Object<string, string>} headers 响应头
 */
function makeRes(body, status = 200, headers = {}) {
	headers['access-control-allow-origin'] = '*' // 允许所有来源
	return new Response(body, { status, headers }) // 返回新构造的响应
}

/**
 * 构造新的URL对象
 * @param {string} urlStr URL字符串
 * @param {string} base URL base
 */
function newUrl(urlStr, base) {
	try {
		console.log(`Constructing new URL object with path ${urlStr} and base ${base}`);
		return new URL(urlStr, base); // 尝试构造新的URL对象
	} catch (err) {
		console.error(err);
		return null // 构造失败返回null
	}
}

async function nginx() {
	const text = `
	<!DOCTYPE html>
	<html>
	<head>
	<title>Welcome to nginx!</title>
	<style>
		body {
			width: 35em;
			margin: 0 auto;
			font-family: Tahoma, Verdana, Arial, sans-serif;
		}
	</style>
	</head>
	<body>
	<h1>Welcome to nginx!</h1>
	<p>If you see this page, the nginx web server is successfully installed and
	working. Further configuration is required.</p>
	
	<p>For online documentation and support please refer to
	<a href="http://nginx.org/">nginx.org</a>.<br/>
	Commercial support is available at
	<a href="http://nginx.com/">nginx.com</a>.</p>
	
	<p><em>Thank you for using nginx.</em></p>
	</body>
	</html>
	`
	return text;
}

async function searchInterface() {
	const html = `
	<!DOCTYPE html>
	<html>
	<head>
		<title>Docker Hub 镜像搜索</title>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<style>
		:root {
			--github-color: rgb(27,86,198);
			--github-bg-color: #ffffff;
			--primary-color: #0066ff;
			--primary-dark: #0052cc;
			--gradient-start: #1a90ff;
			--gradient-end: #003eb3;
			--text-color: #ffffff;
			--shadow-color: rgba(0,0,0,0.1);
			--transition-time: 0.3s;
		}
		
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			margin: 0;
			background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
			padding: 20px;
			color: var(--text-color);
			overflow-x: hidden;
		}

		.container {
			text-align: center;
			width: 100%;
			max-width: 800px;
			padding: 20px;
			margin: 0 auto;
			display: flex;
			flex-direction: column;
			justify-content: center;
			min-height: 60vh;
			animation: fadeIn 0.8s ease-out;
		}

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(20px); }
			to { opacity: 1; transform: translateY(0); }
		}

		.github-corner {
			position: fixed;
			top: 0;
			right: 0;
			z-index: 999;
			transition: transform var(--transition-time) ease;
		}
		
		.github-corner:hover {
			transform: scale(1.08);
		}

		.github-corner svg {
			fill: var(--github-bg-color);
			color: var(--github-color);
			position: absolute;
			top: 0;
			border: 0;
			right: 0;
			width: 80px;
			height: 80px;
			filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.2));
		}

		.logo {
			margin-bottom: 20px;
			transition: transform var(--transition-time) ease;
			animation: float 6s ease-in-out infinite;
		}
		
		@keyframes float {
			0%, 100% { transform: translateY(0); }
			50% { transform: translateY(-10px); }
		}
		
		.logo:hover {
			transform: scale(1.08) rotate(5deg);
		}
		
		.logo svg {
			filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.2));
		}
		
		.title {
			color: var(--text-color);
			font-size: 2.3em;
			margin-bottom: 10px;
			text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
			font-weight: 700;
			letter-spacing: -0.5px;
			animation: slideInFromTop 0.5s ease-out 0.2s both;
		}
		
		@keyframes slideInFromTop {
			from { opacity: 0; transform: translateY(-20px); }
			to { opacity: 1; transform: translateY(0); }
		}
		
		.subtitle {
			color: rgba(255, 255, 255, 0.9);
			font-size: 1.1em;
			margin-bottom: 25px;
			max-width: 600px;
			margin-left: auto;
			margin-right: auto;
			line-height: 1.4;
			animation: slideInFromTop 0.5s ease-out 0.4s both;
		}
		
		.search-container {
			display: flex;
			align-items: stretch;
			width: 100%;
			max-width: 600px;
			margin: 0 auto;
			height: 55px;
			position: relative;
			animation: slideInFromBottom 0.5s ease-out 0.6s both;
			box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
			border-radius: 12px;
			overflow: hidden;
		}
		
		@keyframes slideInFromBottom {
			from { opacity: 0; transform: translateY(20px); }
			to { opacity: 1; transform: translateY(0); }
		}
		
		#search-input {
			flex: 1;
			padding: 0 20px;
			font-size: 16px;
			border: none;
			outline: none;
			transition: all var(--transition-time) ease;
			height: 100%;
		}
		
		#search-input:focus {
			padding-left: 25px;
		}
		
		#search-button {
			width: 60px;
			background-color: var(--primary-color);
			border: none;
			cursor: pointer;
			transition: all var(--transition-time) ease;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			position: relative;
		}
		
		#search-button svg {
			transition: transform 0.3s ease;
			stroke: white;
		}
		
		#search-button:hover {
			background-color: var(--primary-dark);
		}
		
		#search-button:hover svg {
			transform: translateX(2px);
		}
		
		#search-button:active svg {
			transform: translateX(4px);
		}
		
		.tips {
			color: rgba(255, 255, 255, 0.8);
			margin-top: 20px;
			font-size: 0.9em;
			animation: fadeIn 0.5s ease-out 0.8s both;
			transition: transform var(--transition-time) ease;
		}
		
		.tips:hover {
			transform: translateY(-2px);
		}
		
		@media (max-width: 768px) {
			.container {
				padding: 20px 15px;
				min-height: 60vh;
			}
			
			.title {
				font-size: 2em;
			}
			
			.subtitle {
				font-size: 1em;
				margin-bottom: 20px;
			}
			
			.search-container {
				height: 50px;
			}
		}
		
		@media (max-width: 480px) {
			.container {
				padding: 15px 10px;
				min-height: 60vh;
			}
			
			.github-corner svg {
				width: 60px;
				height: 60px;
			}
			
			.search-container {
				height: 45px;
			}
			
			#search-input {
				padding: 0 15px;
			}
			
			#search-button {
				width: 50px;
			}
			
			#search-button svg {
				width: 18px;
				height: 18px;
			}
			
			.title {
				font-size: 1.7em;
				margin-bottom: 8px;
			}
			
			.subtitle {
				font-size: 0.95em;
				margin-bottom: 18px;
			}
		}
		</style>
	</head>
	<body>
		<a href="https://github.com/cmliu/CF-Workers-docker.io" target="_blank" class="github-corner" aria-label="View source on Github">
			<svg viewBox="0 0 250 250" aria-hidden="true">
				<path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path>
				<path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style="transform-origin: 130px 106px;" class="octo-arm"></path>
				<path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path>
			</svg>
		</a>
		<div class="container">
			<div class="logo">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18" fill="#ffffff" width="110" height="85">
					<path d="M23.763 6.886c-.065-.053-.673-.512-1.954-.512-.32 0-.659.03-1.01.087-.248-1.703-1.651-2.533-1.716-2.57l-.345-.2-.227.328a4.596 4.596 0 0 0-.611 1.433c-.23.972-.09 1.884.403 2.666-.596.331-1.546.418-1.744.42H.752a.753.753 0 0 0-.75.749c-.007 1.456.233 2.864.692 4.07.545 1.43 1.355 2.483 2.409 3.13 1.181.725 3.104 1.14 5.276 1.14 1.016 0 2.03-.092 2.93-.266 1.417-.273 2.705-.742 3.826-1.391a10.497 10.497 0 0 0 2.61-2.14c1.252-1.42 1.998-3.005 2.553-4.408.075.003.148.005.221.005 1.371 0 2.215-.55 2.68-1.01.505-.5.685-.998.704-1.053L24 7.076l-.237-.19Z"></path>
					<path d="M2.216 8.075h2.119a.186.186 0 0 0 .185-.186V6a.186.186 0 0 0-.185-.186H2.216A.186.186 0 0 0 2.031 6v1.89c0 .103.083.186.185.186Zm2.92 0h2.118a.185.185 0 0 0 .185-.186V6a.185.185 0 0 0-.185-.186H5.136A.185.185 0 0 0 4.95 6v1.89c0 .103.083.186.186.186Zm2.964 0h2.118a.186.186 0 0 0 .185-.186V6a.186.186 0 0 0-.185-.186H8.1A.185.185 0 0 0 7.914 6v1.89c0 .103.083.186.186.186Zm2.928 0h2.119a.185.185 0 0 0 .185-.186V6a.185.185 0 0 0-.185-.186h-2.119a.186.186 0 0 0-.185.186v1.89c0 .103.083.186.185.186Zm-5.892-2.72h2.118a.185.185 0 0 0 .185-.186V3.28a.186.186 0 0 0-.185-.186H5.136a.186.186 0 0 0-.186.186v1.89c0 .103.083.186.186.186Zm2.964 0h2.118a.186.186 0 0 0 .185-.186V3.28a.186.186 0 0 0-.185-.186H8.1a.186.186 0 0 0-.186.186v1.89c0 .103.083.186.186.186Zm2.928 0h2.119a.185.185 0 0 0 .185-.186V3.28a.186.186 0 0 0-.185-.186h-2.119a.186.186 0 0 0-.185.186v1.89c0 .103.083.186.185.186Zm0-2.72h2.119a.186.186 0 0 0 .185-.186V.56a.185.185 0 0 0-.185-.186h-2.119a.186.186 0 0 0-.185.186v1.89c0 .103.083.186.185.186Zm2.955 5.44h2.118a.185.185 0 0 0 .186-.186V6a.185.185 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.186v1.89c0 .103.083.186.185.186Z"></path>
				</svg>
			</div>
			<h1 class="title">Docker Hub 镜像搜索</h1>
			<p class="subtitle">快速查找、下载和部署 Docker 容器镜像</p>
			<div class="search-container">
				<input type="text" id="search-input" placeholder="输入关键词搜索镜像，如: nginx, mysql, redis...">
				<button id="search-button" title="搜索">
					<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path d="M13 5l7 7-7 7M5 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path>
					</svg>
				</button>
			</div>
			<p class="tips">基于 Cloudflare Workers / Pages 构建，利用全球边缘网络实现毫秒级响应。</p>
		</div>
		<script>
		function performSearch() {
			const query = document.getElementById('search-input').value;
			if (query) {
				window.location.href = '/search?q=' + encodeURIComponent(query);
			}
		}
	
		document.getElementById('search-button').addEventListener('click', performSearch);
		document.getElementById('search-input').addEventListener('keypress', function(event) {
			if (event.key === 'Enter') {
				performSearch();
			}
		});

		// 添加焦点在搜索框
		window.addEventListener('load', function() {
			document.getElementById('search-input').focus();
		});
		</script>
	</body>
	</html>
	`;
	return html;
}

/**
 * 简单的hash函数
 * @param {string} str 输入字符串
 * @returns {string} hash结果
 */
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }
  return hash.toString();
};

/**
 * 生成包含过期时间的token
 * @param {string} password 用户密码
 * @returns {string} 生成的token
 */
const generateToken = (password) => {
  // 过期时间：当前时间 + 6小时
  const expires = Date.now() + 6 * 60 * 60 * 1000;
  // 简单的token生成逻辑，实际应用中可以使用更安全的方法
  const tokenContent = {
    p: simpleHash(password),
    e: expires,
  };
  // 转换为base64字符串
  return btoa(JSON.stringify(tokenContent));
};

/**
 * 验证token是否有效
 * @param {string} token 待验证的token
 * @param {string} password 正确密码
 * @returns {boolean} 是否有效
 */
const verifyToken = (token, password) => {
  try {
    const tokenContent = JSON.parse(atob(token));
    // 检查token是否过期
    if (tokenContent.e < Date.now()) {
      return false;
    }
    // 检查密码hash是否匹配
    return tokenContent.p === simpleHash(password);
  } catch (e) {
    return false;
  }
};

/* @returns {boolean} 是否已认证
 */
const isAuthenticated = async (request, env) => {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return false;

  const cookies = cookie.split(";").map((c) => c.trim());
  const authCookie = cookies.find((c) => c.startsWith("cf_auth_token="));

  if (!authCookie) return false;

  const token = authCookie.split("=")[1];
  return verifyToken(token, env.ACCESS_PASSWORD);
};

/**
 * 处理登录请求
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 */
const handleLogin = async (request, env) => {
  const url = new URL(request.url);

  // 如果是GET请求，返回登录页面
  if (request.method === "GET") {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>量子安全访问系统</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: "Segoe UI", "Agency FB", sans-serif;
            }

            body {
              background: linear-gradient(135deg, #0c0e1d, #1a1b3d, #2c0b3d);
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              overflow: hidden;
              position: relative;
            }

            /* 科幻背景元素 */
            .grid-lines {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(
                  rgba(25, 130, 180, 0.1) 1px,
                  transparent 1px
                ),
                linear-gradient(90deg, rgba(25, 130, 180, 0.1) 1px, transparent 1px);
              background-size: 30px 30px;
              z-index: 0;
            }

            .glowing-circle {
              position: absolute;
              width: 400px;
              height: 400px;
              border-radius: 50%;
              background: radial-gradient(
                circle,
                rgba(65, 105, 225, 0.4),
                transparent 70%
              );
              top: -150px;
              right: -150px;
              filter: blur(30px);
              animation: pulse 4s infinite alternate;
            }

            .glowing-circle:nth-child(2) {
              width: 300px;
              height: 300px;
              background: radial-gradient(
                circle,
                rgba(138, 43, 226, 0.4),
                transparent 70%
              );
              top: auto;
              bottom: -100px;
              left: -100px;
              animation-delay: -2s;
            }

            /* 登录卡片 */
            .login-card {
              background: rgba(20, 22, 40, 0.6);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(65, 105, 225, 0.4);
              border-radius: 16px;
              padding: 40px 50px;
              width: 90%;
              max-width: 450px;
              z-index: 1;
              position: relative;
              box-shadow: 0 0 30px rgba(65, 105, 225, 0.3),
                0 0 60px rgba(138, 43, 226, 0.1);
              overflow: hidden;
            }

            .login-card::before {
              content: "";
              position: absolute;
              top: -2px;
              left: -2px;
              right: -2px;
              bottom: -2px;
              background: linear-gradient(45deg, #4169e1, #8a2be2, #4169e1, #8a2be2);
              z-index: -1;
              border-radius: 18px;
              animation: border-animate 4s linear infinite;
              background-size: 500% 500%;
            }

            .login-card::after {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: inherit;
              border-radius: 16px;
              z-index: -1;
            }

            .card-header {
              text-align: center;
              margin-bottom: 35px;
            }

            .card-header h1 {
              color: #e0e0ff;
              font-size: 2.2rem;
              letter-spacing: 2px;
              text-transform: uppercase;
              text-shadow: 0 0 10px rgba(65, 105, 225, 0.8);
              margin-bottom: 10px;
              font-weight: 600;
            }

            .card-header p {
              color: #a0a0d0;
              font-size: 1rem;
              letter-spacing: 1px;
            }

            /* 输入框样式 */
            .input-group {
              margin-bottom: 30px;
              position: relative;
            }

            .input-group label {
              display: block;
              color: #a0a0d0;
              margin-bottom: 8px;
              font-size: 0.9rem;
              letter-spacing: 1px;
            }

            .input-field {
              width: 100%;
              background: rgba(10, 12, 30, 0.5);
              border: 1px solid rgba(65, 105, 225, 0.3);
              border-radius: 8px;
              padding: 14px 20px;
              color: #e0e0ff;
              font-size: 1rem;
              letter-spacing: 1px;
              transition: all 0.3s ease;
            }

            .input-field:focus {
              outline: none;
              border-color: #4169e1;
              box-shadow: 0 0 15px rgba(65, 105, 225, 0.5);
            }

            .input-field::placeholder {
              color: #6060a0;
            }

            /* 按钮样式 */
            .submit-btn {
              width: 100%;
              background: linear-gradient(45deg, #4169e1, #8a2be2);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 16px;
              font-size: 1.1rem;
              font-weight: 600;
              letter-spacing: 2px;
              text-transform: uppercase;
              cursor: pointer;
              transition: all 0.3s ease;
              position: relative;
              overflow: hidden;
              box-shadow: 0 5px 20px rgba(65, 105, 225, 0.4);
            }

            .submit-btn::after {
              content: "";
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: rgba(255, 255, 255, 0.1);
              transform: rotate(30deg);
              transition: all 0.6s ease;
            }

            .submit-btn:hover {
              transform: translateY(-3px);
              box-shadow: 0 8px 25px rgba(65, 105, 225, 0.6);
            }

            .submit-btn:hover::after {
              transform: rotate(30deg) translate(20%, 20%);
            }

            .submit-btn:active {
              transform: translateY(0);
            }

            /* 科幻元素 */
            .scan-line {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 3px;
              background: linear-gradient(
                90deg,
                transparent,
                #4169e1,
                #8a2be2,
                transparent
              );
              animation: scan 4s linear infinite;
            }

            .terminal-dots {
              position: absolute;
              bottom: 25px;
              left: 30px;
              display: flex;
              gap: 6px;
            }

            .dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #4169e1;
              opacity: 0.7;
              animation: dot-pulse 1.4s infinite ease-in-out;
            }

            .dot:nth-child(2) {
              animation-delay: 0.2s;
            }
            .dot:nth-child(3) {
              animation-delay: 0.4s;
            }

            /* 动画 */
            @keyframes pulse {
              0% {
                opacity: 0.3;
              }
              100% {
                opacity: 0.6;
              }
            }

            @keyframes border-animate {
              0% {
                background-position: 0% 0%;
              }
              100% {
                background-position: 500% 0%;
              }
            }

            @keyframes scan {
              0% {
                transform: translateY(0);
              }
              100% {
                transform: translateY(100vh);
              }
            }

            @keyframes dot-pulse {
              0%,
              100% {
                transform: scale(1);
                opacity: 0.7;
              }
              50% {
                transform: scale(1.3);
                opacity: 1;
              }
            }

            /* 响应式调整 */
            @media (max-width: 500px) {
              .login-card {
                padding: 30px;
              }

              .card-header h1 {
                font-size: 1.8rem;
              }
            }
          </style>
        </head>
        <body>
          <div class="grid-lines"></div>
          <div class="glowing-circle"></div>
          <div class="glowing-circle"></div>

          <div class="login-card">
            <div class="scan-line"></div>

            <div class="card-header">
              <h1>量子安全通道</h1>
              <p>请验证您的访问凭证</p>
            </div>

            <form method="POST">
              <div class="input-group">
                <label for="password">访问密钥</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  class="input-field"
                  placeholder="请输入访问密钥"
                  required
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
              </div>

              <input type="hidden" name="redirect" value="${url.searchParams.get('redirect') || '/' }">

              <button type="submit" class="submit-btn"><span>身份验证</span></button>
            </form>

            <div class="terminal-dots">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </div>

          <script>
            // 添加简单的粒子效果
            document.addEventListener("DOMContentLoaded", function () {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              canvas.width = window.innerWidth;
              canvas.height = window.innerHeight;
              canvas.style.position = "fixed";
              canvas.style.top = "0";
              canvas.style.left = "0";
              canvas.style.zIndex = "0";
              document.body.appendChild(canvas);

              const particles = [];
              const particleCount = 100;
              const colors = ["#4169e1", "#8a2be2", "#5d42f5", "#3c8ce7"];

              class Particle {
                constructor() {
                  this.x = Math.random() * canvas.width;
                  this.y = Math.random() * canvas.height;
                  this.size = Math.random() * 2 + 0.5;
                  this.speedX = (Math.random() - 0.5) * 0.5;
                  this.speedY = (Math.random() - 0.5) * 0.5;
                  this.color = colors[Math.floor(Math.random() * colors.length)];
                }

                update() {
                  this.x += this.speedX;
                  this.y += this.speedY;

                  if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
                  if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
                }

                draw() {
                  ctx.fillStyle = this.color;
                  ctx.beginPath();
                  ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                  ctx.fill();
                }
              }

              function init() {
                for (let i = 0; i < particleCount; i++) {
                  particles.push(new Particle());
                }
              }

              function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                particles.forEach((particle) => {
                  particle.update();
                  particle.draw();
                });

                requestAnimationFrame(animate);
              }

              init();
              animate();

              // 响应窗口大小变化
              window.addEventListener("resize", function () {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
              });
            });
          </script>
        </body>
      </html>
    `,{
      headers: { "Content-Type": "text/html" },
    });
  }

  // 如果是POST请求，验证密码
  if (request.method === "POST") {
    const formData = await request.formData();
    const passwordI = formData.get("password");
    const redirectI = formData.get("redirect") || "/";

    // 验证密码是否正确（从环境变量获取正确密码）
    if (passwordI === env.ACCESS_PASSWORD) {
      // 设置6小时过期
      const expires = new Date(Date.now() + 6 * 60 * 60 * 1000).toUTCString();
      // return response;
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${url.protocol}//${url.host}${decodeURIComponent(redirectI)}`,
          "Set-Cookie": `cf_auth_token=${generateToken(passwordI)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`,
        },
      });
    } else {
      // 密码错误，返回错误信息
      return new Response("Invalid password", { status: 401 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export default {
	async fetch(request, env, ctx) {
		const getReqHeader = (key) => request.headers.get(key); // 获取请求头

		let url = new URL(request.url); // 解析请求URL
		const userAgentHeader = request.headers.get('User-Agent');
		const userAgent = userAgentHeader ? userAgentHeader.toLowerCase() : "null";
		if (env.UA) 屏蔽爬虫UA = 屏蔽爬虫UA.concat(await ADD(env.UA));
		const workers_url = `https://${url.hostname}`;

		// 获取请求参数中的 ns
		const ns = url.searchParams.get('ns');
		const hostname = url.searchParams.get('hubhost') || url.hostname;
		const hostTop = hostname.split('.')[0]; // 获取主机名的第一部分

		let checkHost; // 在这里定义 checkHost 变量
		// 如果存在 ns 参数，优先使用它来确定 hub_host
		if (ns) {
			if (ns === 'docker.io') {
				hub_host = 'registry-1.docker.io'; // 设置上游地址为 registry-1.docker.io
			} else {
				hub_host = ns; // 直接使用 ns 作为 hub_host
			}
		} else {
			checkHost = routeByHosts(hostTop);
			hub_host = checkHost[0]; // 获取上游地址
		}

		const fakePage = checkHost ? checkHost[1] : false; // 确保 fakePage 不为 undefined
		console.log(`域名头部: ${hostTop} 反代地址: ${hub_host} searchInterface: ${fakePage}`);
		// 更改请求的主机名
		url.hostname = hub_host;
		const hubParams = ['/v1/search', '/v1/repositories'];
		if (屏蔽爬虫UA.some(fxxk => userAgent.includes(fxxk)) && 屏蔽爬虫UA.length > 0) {
			// 首页改成一个nginx伪装页
			return new Response(await nginx(), {
				headers: {
					'Content-Type': 'text/html; charset=UTF-8',
				},
			});
		} else if ((userAgent && userAgent.includes('mozilla')) || hubParams.some(param => url.pathname.includes(param))) {
			if (url.pathname == '/') {
				if (env.ACCESS_PASSWORD) {
			      if (url.pathname === "/cf-login") return handleLogin(request, env);
			      // 检查是否是登录页面或静态资源
			      if (!(await isAuthenticated(request, env))) {
			        // 未登录且不是公开路由，重定向到登录页面
			        return new Response(null, {
			          status: 302,
			          headers: {
			            Location: `${url.protocol}//${url.host}/cf-login?redirect=${encodeURIComponent(url.pathname)}`,
			          },
			        });
			      }
			    }
				if (env.URL302) {
					return Response.redirect(env.URL302, 302);
				} else if (env.URL) {
					if (env.URL.toLowerCase() == 'nginx') {
						//首页改成一个nginx伪装页
						return new Response(await nginx(), {
							headers: {
								'Content-Type': 'text/html; charset=UTF-8',
							},
						});
					} else return fetch(new Request(env.URL, request));
				} else	{
					if (fakePage) return new Response(await searchInterface(), {
						headers: {
							'Content-Type': 'text/html; charset=UTF-8',
						},
					});
				}
			} else {
				// 新增逻辑：/v1/ 路径特殊处理
				if (url.pathname.startsWith('/v1/')) {
					url.hostname = 'index.docker.io';
				} else if (fakePage) {
					url.hostname = 'hub.docker.com';
				}
				if (url.searchParams.get('q')?.includes('library/') && url.searchParams.get('q') != 'library/') {
					const search = url.searchParams.get('q');
					url.searchParams.set('q', search.replace('library/', ''));
				}
				const newRequest = new Request(url, request);
				return fetch(newRequest);
			}
		}

		// 修改包含 %2F 和 %3A 的请求
		if (!/%2F/.test(url.search) && /%3A/.test(url.toString())) {
			let modifiedUrl = url.toString().replace(/%3A(?=.*?&)/, '%3Alibrary%2F');
			url = new URL(modifiedUrl);
			console.log(`handle_url: ${url}`);
		}

		// 处理token请求
		if (url.pathname.includes('/token')) {
			let token_parameter = {
				headers: {
					'Host': 'auth.docker.io',
					'User-Agent': getReqHeader("User-Agent"),
					'Accept': getReqHeader("Accept"),
					'Accept-Language': getReqHeader("Accept-Language"),
					'Accept-Encoding': getReqHeader("Accept-Encoding"),
					'Connection': 'keep-alive',
					'Cache-Control': 'max-age=0'
				}
			};
			let token_url = auth_url + url.pathname + url.search;
			return fetch(new Request(token_url, request), token_parameter);
		}

		// 修改 /v2/ 请求路径
		if (hub_host == 'registry-1.docker.io' && /^\/v2\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname) && !/^\/v2\/library/.test(url.pathname)) {
			//url.pathname = url.pathname.replace(/\/v2\//, '/v2/library/');
			url.pathname = '/v2/library/' + url.pathname.split('/v2/')[1];
			console.log(`modified_url: ${url.pathname}`);
		}

		// 新增：/v2/、/manifests/、/blobs/、/tags/ 先获取token再请求
		if (
			url.pathname.startsWith('/v2/') &&
			(
				url.pathname.includes('/manifests/') ||
				url.pathname.includes('/blobs/') ||
				url.pathname.includes('/tags/')
				|| url.pathname.endsWith('/tags/list')
			)
		) {
			// 提取镜像名
			let repo = '';
			const v2Match = url.pathname.match(/^\/v2\/(.+?)(?:\/(manifests|blobs|tags)\/)/);
			if (v2Match) {
				repo = v2Match[1];
			}
			if (repo) {
				const tokenUrl = `${auth_url}/token?service=registry.docker.io&scope=repository:${repo}:pull`;
				const tokenRes = await fetch(tokenUrl, {
					headers: {
						'User-Agent': getReqHeader("User-Agent"),
						'Accept': getReqHeader("Accept"),
						'Accept-Language': getReqHeader("Accept-Language"),
						'Accept-Encoding': getReqHeader("Accept-Encoding"),
						'Connection': 'keep-alive',
						'Cache-Control': 'max-age=0'
					}
				});
				const tokenData = await tokenRes.json();
				const token = tokenData.token;
				let parameter = {
					headers: {
						'Host': hub_host,
						'User-Agent': getReqHeader("User-Agent"),
						'Accept': getReqHeader("Accept"),
						'Accept-Language': getReqHeader("Accept-Language"),
						'Accept-Encoding': getReqHeader("Accept-Encoding"),
						'Connection': 'keep-alive',
						'Cache-Control': 'max-age=0',
						'Authorization': `Bearer ${token}`
					},
					cacheTtl: 3600
				};
				if (request.headers.has("X-Amz-Content-Sha256")) {
					parameter.headers['X-Amz-Content-Sha256'] = getReqHeader("X-Amz-Content-Sha256");
				}
				let original_response = await fetch(new Request(url, request), parameter);
				let original_response_clone = original_response.clone();
				let original_text = original_response_clone.body;
				let response_headers = original_response.headers;
				let new_response_headers = new Headers(response_headers);
				let status = original_response.status;
				if (new_response_headers.get("Www-Authenticate")) {
					let auth = new_response_headers.get("Www-Authenticate");
					let re = new RegExp(auth_url, 'g');
					new_response_headers.set("Www-Authenticate", response_headers.get("Www-Authenticate").replace(re, workers_url));
				}
				if (new_response_headers.get("Location")) {
					const location = new_response_headers.get("Location");
					console.info(`Found redirection location, redirecting to ${location}`);
					return httpHandler(request, location, hub_host);
				}
				let response = new Response(original_text, {
					status,
					headers: new_response_headers
				});
				return response;
			}
		}

		// 构造请求参数
		let parameter = {
			headers: {
				'Host': hub_host,
				'User-Agent': getReqHeader("User-Agent"),
				'Accept': getReqHeader("Accept"),
				'Accept-Language': getReqHeader("Accept-Language"),
				'Accept-Encoding': getReqHeader("Accept-Encoding"),
				'Connection': 'keep-alive',
				'Cache-Control': 'max-age=0'
			},
			cacheTtl: 3600 // 缓存时间
		};

		// 添加Authorization头
		if (request.headers.has("Authorization")) {
			parameter.headers.Authorization = getReqHeader("Authorization");
		}

		// 添加可能存在字段X-Amz-Content-Sha256
		if (request.headers.has("X-Amz-Content-Sha256")) {
			parameter.headers['X-Amz-Content-Sha256'] = getReqHeader("X-Amz-Content-Sha256");
		}

		// 发起请求并处理响应
		let original_response = await fetch(new Request(url, request), parameter);
		let original_response_clone = original_response.clone();
		let original_text = original_response_clone.body;
		let response_headers = original_response.headers;
		let new_response_headers = new Headers(response_headers);
		let status = original_response.status;

		// 修改 Www-Authenticate 头
		if (new_response_headers.get("Www-Authenticate")) {
			let auth = new_response_headers.get("Www-Authenticate");
			let re = new RegExp(auth_url, 'g');
			new_response_headers.set("Www-Authenticate", response_headers.get("Www-Authenticate").replace(re, workers_url));
		}

		// 处理重定向
		if (new_response_headers.get("Location")) {
			const location = new_response_headers.get("Location");
			console.info(`Found redirection location, redirecting to ${location}`);
			return httpHandler(request, location, hub_host);
		}

		// 返回修改后的响应
		let response = new Response(original_text, {
			status,
			headers: new_response_headers
		});
		return response;
	}
};

/**
 * 处理HTTP请求
 * @param {Request} req 请求对象
 * @param {string} pathname 请求路径
 * @param {string} baseHost 基地址
 */
function httpHandler(req, pathname, baseHost) {
	const reqHdrRaw = req.headers;

	// 处理预检请求
	if (req.method === 'OPTIONS' &&
		reqHdrRaw.has('access-control-request-headers')
	) {
		return new Response(null, PREFLIGHT_INIT);
	}

	let rawLen = '';

	const reqHdrNew = new Headers(reqHdrRaw);

	reqHdrNew.delete("Authorization"); // 修复s3错误

	const refer = reqHdrNew.get('referer');

	let urlStr = pathname;

	const urlObj = newUrl(urlStr, 'https://' + baseHost);

	/** @type {RequestInit} */
	const reqInit = {
		method: req.method,
		headers: reqHdrNew,
		redirect: 'follow',
		body: req.body
	};
	return proxy(urlObj, reqInit, rawLen);
}

/**
 * 代理请求
 * @param {URL} urlObj URL对象
 * @param {RequestInit} reqInit 请求初始化对象
 * @param {string} rawLen 原始长度
 */
async function proxy(urlObj, reqInit, rawLen) {
	const res = await fetch(urlObj.href, reqInit);
	const resHdrOld = res.headers;
	const resHdrNew = new Headers(resHdrOld);

	// 验证长度
	if (rawLen) {
		const newLen = resHdrOld.get('content-length') || '';
		const badLen = (rawLen !== newLen);

		if (badLen) {
			return makeRes(res.body, 400, {
				'--error': `bad len: ${newLen}, except: ${rawLen}`,
				'access-control-expose-headers': '--error',
			});
		}
	}
	const status = res.status;
	resHdrNew.set('access-control-expose-headers', '*');
	resHdrNew.set('access-control-allow-origin', '*');
	resHdrNew.set('Cache-Control', 'max-age=1500');

	// 删除不必要的头
	resHdrNew.delete('content-security-policy');
	resHdrNew.delete('content-security-policy-report-only');
	resHdrNew.delete('clear-site-data');

	return new Response(res.body, {
		status,
		headers: resHdrNew
	});
}

async function ADD(envadd) {
	var addtext = envadd.replace(/[	 |"'\r\n]+/g, ',').replace(/,+/g, ',');	// 将空格、双引号、单引号和换行符替换为逗号
	if (addtext.charAt(0) == ',') addtext = addtext.slice(1);
	if (addtext.charAt(addtext.length - 1) == ',') addtext = addtext.slice(0, addtext.length - 1);
	const add = addtext.split(',');
	return add;
}
