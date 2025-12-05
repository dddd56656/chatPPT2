#!/bin/sh

# 定义输出文件路径
OUTPUT_FILE="/usr/share/nginx/html/env-config.js"

# 1. 开始生成 JS 文件
echo "window._env_ = {" > $OUTPUT_FILE

# 2. 注入 API_BASE_URL
if [ -n "$API_BASE_URL" ]; then
  echo "  API_BASE_URL: \"$API_BASE_URL\"," >> $OUTPUT_FILE
fi

# 3. 注入 APP_TITLE
if [ -n "$APP_TITLE" ]; then
  echo "  APP_TITLE: \"$APP_TITLE\"," >> $OUTPUT_FILE
fi

echo "};" >> $OUTPUT_FILE

# 4. 启动 Nginx
exec "$@"
