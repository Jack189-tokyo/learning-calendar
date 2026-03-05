# 使用 Nginx 作为基础镜像
# 使用轻量级的 Nginx 镜像作为基础
FROM nginx:alpine

# 将当前目录下的所有文件复制到 Nginx 的网站根目录
# 将当前目录下的所有文件（index.html, client.js, style.css 等）复制到 Nginx 容器的网站根目录
COPY . /usr/share/nginx/html

# 暴露 80 端口
# 容器内部暴露 80 端口
EXPOSE 80
