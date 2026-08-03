#!/usr/bin/env python3
"""여러 파일로 나뉜 앱을 '파일 하나'로 묶습니다.

사용법:  python3 build-standalone.py
결과물:  케이크공방-운영노트.html  (이 파일 하나만 있으면 인터넷 없이 실행됩니다)

css/js 를 고친 뒤에는 이 스크립트를 다시 실행해 주세요.
"""
import re
import os

BASE = os.path.dirname(os.path.abspath(__file__))
OUT_NAME = '케이크공방-운영노트.html'


def read(rel):
    with open(os.path.join(BASE, rel), encoding='utf-8') as f:
        return f.read()


def build():
    html = read('index.html')

    # <link rel="stylesheet"> 를 실제 CSS 로 교체
    css = read('css/style.css')
    html = re.sub(
        r'\s*<link rel="stylesheet" href="css/style\.css">',
        '\n<style>\n' + css + '\n</style>',
        html,
    )

    # <script src="..."> 를 실제 JS 로 교체 (순서 유지)
    sources = re.findall(r'<script src="([^"]+)"></script>', html)
    bundle = '\n'.join(
        '/* ===== %s ===== */\n%s' % (src, read(src)) for src in sources
    )
    html = re.sub(r'\s*<script src="[^"]+"></script>', '', html)
    html = html.replace('</body>', '<script>\n' + bundle + '\n</script>\n</body>')

    out_path = os.path.join(BASE, OUT_NAME)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)

    size_kb = round(os.path.getsize(out_path) / 1024)
    print('%s 개 스크립트를 묶었습니다.' % len(sources))
    print('완성: %s (%s KB)' % (out_path, size_kb))


if __name__ == '__main__':
    build()
