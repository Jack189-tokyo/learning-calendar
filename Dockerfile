# 使用 Nginx 作为基础镜像
FROM nginx:alpine

# 将当前目录下的所有文件复制到 Nginx 的网站根目录
COPY . /usr/share/nginx/html

# 暴露 80 端口
EXPOSE 80
