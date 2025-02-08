#!/bin/bash

# 指定目录，这里以当前目录为例，你可以修改为实际目录
directory="../storage/key_value_stores/chapters"

# 遍历目录下所有以 _*.json 或 _*_2.json 结尾的文件
for file in "$directory"/*_*.{json,_2.json}; do
    if [ -f "$file" ]; then
        # 提取文件名中第一个 _ 之前的部分
        base_name=$(basename "$file" | cut -d '_' -f 1)
        echo "$base_name"
    fi
done | sort -u