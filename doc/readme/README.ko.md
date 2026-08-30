<p align="center"><img src="../../addon/content/icons/icon-96.png" alt="Zotero Research Copilot 로고" width="88" /></p>
<h1 align="center">Zotero Research Copilot</h1>
<p align="center">Zotero 안에서 논문을 읽고, 대화하고, 검색하고, 정리하는 AI 연구 작업 공간입니다.</p>
<p align="center"><a href="../../README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.zh-TW.md">繁體中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.fr.md">Français</a></p>
<p align="center"><a href="https://github.com/chrislucy838-collab/zotero-research-copilot/releases"><strong>최신 XPI 다운로드</strong></a> · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/issues">Issues</a> · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/discussions">Discussions</a></p>

> **지원 버전:** Zotero 10.x.

## 주요 기능

- Zotero 라이브러리 항목 패널, PDF 리더, EPUB 리더 사이드바에서 연구 대화.
- 현재 논문, 선택한 텍스트, 추가 논문, 이미지, 업로드 파일을 컨텍스트로 사용.
- 입력창의 `@` 또는 Zotero 컬렉션에서 여러 논문 추가.
- 대화 편집, 재시도, 분기, 고정, 삭제, 내보내기, Zotero 노트 저장.
- PDF/EPUB 문서 구조를 고려한 제한된 컨텍스트 검색.
- **Discover** 탭에서 OpenAlex, Semantic Scholar, Crossref를 검색하고 확인 후 중복을 검사하여 Zotero에 가져오기.
- 파일 붙여넣기·드래그·업로드 및 리더에서 그림/표/수식 영역 캡처.
- PDF/EPUB 선택 영역 번역. 모델, 언어, 자동 실행, 복사/노트 작업을 설정 가능.
- OpenAI 호환 API를 통해 호스팅, 로컬 또는 자체 호스팅 모델에 연결.
- 대화 기록과 메모리를 Zotero 로컬 데이터에 저장하고 Markdown, 표, 이미지, LaTeX 표시.

## 모델 연결

**Tools → Add-ons → Zotero Research Copilot → Settings**를 열고 API Base URL과 Model을 입력합니다. API Key와 Custom Headers는 필요할 때 입력합니다. 예: `https://api.openai.com/v1`, `http://127.0.0.1:11434/v1`. 보통 `/models`와 `/chat/completions` 형태를 제공해야 합니다.

## 설치

1. [Releases](https://github.com/chrislucy838-collab/zotero-research-copilot/releases)에서 `Zotero-Research-Copilot-<version>.xpi`를 다운로드합니다.
2. Zotero에서 **Tools → Add-ons → gear → Install Add-on From File…**을 엽니다.
3. XPI를 선택하고 필요하면 Zotero를 재시작합니다.
4. Zotero Research Copilot Settings에서 API를 설정합니다.

지원 버전은 Zotero **10.0–10.x**입니다. 새 XPI를 기존 설치 위에 설치하여 업그레이드할 수 있습니다.

## 개인정보 및 라이선스

API 요청은 Zotero에서 설정한 엔드포인트로 직접 전송됩니다. 플러그인 자체의 텔레메트리나 프록시는 없습니다. 키와 사용자 지정 헤더는 로컬에서 설정합니다. 제3자 모델로 전송되는 컨텍스트와 파일은 해당 서비스의 정책을 따릅니다.

라이선스는 [AGPL-3.0-or-later](../../LICENSE)입니다.
