# 전역(global) 스킬 설치 스크립트

`wonhp1/claude-skills` 레포에 있는 스킬(홈페이지 만드는 스킬 등)을 **전역 스킬**로 설치하는 스크립트입니다.
전역으로 설치하면 어느 프로젝트 디렉터리에서 Claude Code를 켜든 해당 스킬이 자동으로 로드됩니다.

> 이 스크립트는 이 레포(STN 실험)의 코드와는 무관하며, 여기 보관만 되어 있습니다.

## 빠른 시작

```bash
# 1) 레포에 어떤 스킬이 있는지 먼저 확인 (private 레포면 --ssh)
bash scripts/install-global-skill.sh --ssh --list

# 2) 홈페이지 스킬 자동 탐지 후 설치
bash scripts/install-global-skill.sh --ssh

# 2') 이름을 정확히 알면 지정해서 설치
bash scripts/install-global-skill.sh --ssh --skill <skill-name>
```

설치 후 **Claude Code를 재시작**해야 새 스킬이 인식됩니다. (스킬은 시작 시점에 스캔됩니다.)

## 전역 스킬 vs 프로젝트 스킬

Claude Code는 두 곳에서 스킬을 찾습니다.

| 위치 | 범위 |
|---|---|
| `~/.claude/skills/<name>/SKILL.md` | **전역** — 모든 프로젝트에서 사용 가능 |
| `<repo>/.claude/skills/<name>/SKILL.md` | **프로젝트** — 그 레포에서 작업할 때만 |

홈페이지 만드는 스킬처럼 특정 레포에 매이지 않는 도구는 전역이 맞습니다. 이 스크립트는 전역 쪽에 설치합니다.

## 동작 방식 (symlink)

기본 모드는 symlink입니다. 레포를 한 곳에만 clone해 두고, 전역 스킬 디렉터리에서 그쪽을 가리키게 합니다.

```
~/.claude/skills-src/claude-skills/     <- git clone (여기가 원본)
└── skills/
    └── homepage-builder/
        └── SKILL.md
              ^
              │ symlink
~/.claude/skills/                        <- Claude Code가 스캔하는 곳
└── homepage-builder  ────────────────────┘
```

덕분에 `git pull` 한 번이면 설치된 스킬이 최신으로 갱신됩니다. 파일이 두 벌로 갈라지지 않습니다.

symlink가 싫거나 Claude Code 빌드가 symlink를 따라가지 않으면 `--mode copy`를 쓰세요. 대신 갱신할 때마다 스크립트를 다시 실행해야 합니다.

## 스킬 자동 탐지

`--skill`을 생략하면 `skills/*/SKILL.md`를 훑어서 디렉터리 이름과 frontmatter의 `name`/`description`에
`homepage`, `website`, `landing`, `홈페이지`, `웹사이트` 같은 키워드가 있는 스킬을 찾습니다.

- 정확히 1개가 걸리면 그것을 설치합니다.
- **0개거나 2개 이상이면 아무것도 설치하지 않고** 전체 목록을 출력한 뒤 종료합니다(exit 2).
  엉뚱한 스킬을 전역에 심는 것보다 낫기 때문입니다. 목록을 보고 `--skill <name>`으로 다시 실행하세요.

## 갱신

```bash
# symlink 모드
git -C ~/.claude/skills-src/claude-skills pull
# 또는 스크립트 재실행 (fetch + reset --hard 후 링크 갱신)
bash scripts/install-global-skill.sh --ssh --skill <skill-name>
```

## 제거

```bash
bash scripts/install-global-skill.sh --uninstall --skill <skill-name>
```

이 스크립트가 설치한 것(캐시를 가리키는 symlink, 또는 receipt에 기록된 copy)만 지웁니다.
직접 만든 스킬이나 다른 경로를 가리키는 symlink는 경고만 띄우고 건드리지 않습니다.

## 전체 옵션

```
--repo <url>          소스 레포. 기본: https://github.com/wonhp1/claude-skills.git
--ssh                 위 URL 대신 git@github.com:wonhp1/claude-skills.git 사용 (private 레포)
--ref <branch|tag>    체크아웃할 브랜치/태그. 기본: 레포 HEAD
--src-dir <path>      레포 안의 스킬 루트. 기본: skills
--skill <name>        설치할 스킬. 여러 번 지정 가능. 생략 시 자동 탐지
--mode symlink|copy   설치 방식. 기본: symlink
--dest <path>         전역 스킬 디렉터리. 기본: ~/.claude/skills
--cache <path>        clone 위치. 기본: ~/.claude/skills-src/<repo-name>
--list                레포의 스킬 목록만 출력하고 종료
--offline             clone/fetch 생략, 기존 --cache를 그대로 사용
--uninstall           이 스크립트가 설치한 스킬 제거
-h, --help
```

## 트러블슈팅

**clone이 실패합니다 (private 레포)**
- SSH: `--ssh`를 붙이고 `ssh -T git@github.com`이 되는지 확인
- HTTPS: `gh auth login` 또는 git credential helper 설정
- 이미 로컬에 clone이 있으면 네트워크 없이:
  `bash scripts/install-global-skill.sh --offline --cache /path/to/claude-skills --skill <name>`

**설치는 됐는데 스킬 목록에 안 보입니다**
1. Claude Code를 완전히 재시작했는지 확인 (스킬은 시작 시 스캔)
2. `~/.claude/skills/<name>/SKILL.md`가 실제로 열리는지 확인
3. `SKILL.md` 맨 위에 `---`로 감싼 `name:` / `description:` frontmatter가 있는지 확인
4. 그래도 안 되면 `--mode copy`로 재설치

**이름이 겹쳤습니다**
같은 이름의 스킬이 이미 있으면 덮어쓰지 않고 `~/.claude/skills/<name>.bak.<타임스탬프>`로 옮긴 뒤 경고를 띄웁니다.
`--uninstall`도 백업은 건드리지 않으니, 필요 없어지면 직접 지우세요.

**`--src-dir`을 바꿔야 하나요?**
레포 구조가 `skills/<name>/SKILL.md`가 아니라면 (예: 최상위에 스킬 폴더가 바로 있다면) `--src-dir .`을 쓰세요.
