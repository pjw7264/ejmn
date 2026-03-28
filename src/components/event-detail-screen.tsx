"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { AvailabilityComposer } from "./availability-composer.js";

type MemberDetail = {
  name: string;
  rrule: string;
};

type EventDetail = {
  id: string;
  name: string;
  slotMinutes: number;
  start: string;
  end: string;
  members: MemberDetail[];
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-found"; message: string }
  | { status: "ready"; event: EventDetail };

function formatLocal(dateTime: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateTime));
}

export function EventDetailScreen({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setState({ status: "loading" });

      try {
        const response = await fetch(`/api/events/${eventId}`, { cache: "no-store" });
        const payload = await response.json();

        if (!active) {
          return;
        }

        if (!response.ok) {
          if (payload?.error?.code === "EVENT_NOT_FOUND") {
            setState({
              status: "not-found",
              message: payload?.error?.message ?? "이벤트를 찾을 수 없습니다.",
            });
            return;
          }

          setState({
            status: "error",
            message: payload?.error?.message ?? "이벤트를 불러오지 못했습니다.",
          });
          return;
        }

        setState({
          status: "ready",
          event: payload as EventDetail,
        });
      } catch {
        if (active) {
          setState({
            status: "error",
            message: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
          });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [eventId]);

  const participantCount = useMemo(() => {
    if (state.status !== "ready") {
      return 0;
    }

    return state.event.members.length;
  }, [state]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (state.status === "loading") {
    return (
      <main style={styles.page}>
        <section style={styles.centerCard}>이벤트를 불러오는 중입니다...</section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main style={styles.page}>
        <section style={styles.centerCard}>
          <h1 style={styles.centerTitle}>이벤트를 불러오지 못했습니다</h1>
          <p style={styles.centerText}>{state.message}</p>
        </section>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main style={styles.page}>
        <section style={styles.centerCard}>
          <h1 style={styles.centerTitle}>이벤트가 없습니다</h1>
          <p style={styles.centerText}>{state.message}</p>
        </section>
      </main>
    );
  }

  const { event } = state;

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.headerCard}>
          <div>
            <p style={styles.eyebrow}>Event Detail</p>
            <h1 style={styles.headerTitle}>{event.name}</h1>
            <p style={styles.headerText}>
              {formatLocal(event.start)} ~ {formatLocal(event.end)}
            </p>
            <p style={styles.headerText}>슬롯 단위 {event.slotMinutes}분</p>
          </div>

          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={() => setPanelOpen((value) => !value)}>
              {panelOpen ? "입력 패널 닫기" : "내 일정 등록/수정"}
            </button>
            <button type="button" style={styles.primaryButton} onClick={handleCopy}>
              {copied ? "링크 복사됨" : "링크 공유"}
            </button>
          </div>
        </div>

        <div style={styles.summaryGrid}>
          <article style={styles.metricCard}>
            <p style={styles.metricLabel}>이벤트 ID</p>
            <strong style={styles.metricValue}>{event.id}</strong>
          </article>
          <article style={styles.metricCard}>
            <p style={styles.metricLabel}>참여자 수</p>
            <strong style={styles.metricValue}>{participantCount}명</strong>
          </article>
          <article style={styles.metricCard}>
            <p style={styles.metricLabel}>응답 기준</p>
            <strong style={styles.metricValue}>최신 서버 응답</strong>
          </article>
        </div>

        <section style={styles.bodyGrid}>
          <article style={styles.membersCard}>
            <div style={styles.cardHeader}>
              <div>
                <p style={styles.cardEyebrow}>Participants</p>
                <h2 style={styles.cardTitle}>참여자 현황</h2>
              </div>
            </div>

            {event.members.length === 0 ? (
              <p style={styles.emptyText}>아직 등록된 참여자가 없습니다. 먼저 내 일정을 등록해 보세요.</p>
            ) : (
              <ul style={styles.memberList}>
                {event.members.map((member) => (
                  <li key={`${member.name}-${member.rrule}`} style={styles.memberItem}>
                    <div>
                      <strong style={styles.memberName}>{member.name}</strong>
                      <p style={styles.memberRule}>{member.rrule}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <aside style={styles.sideCard}>
            <p style={styles.cardEyebrow}>Purpose</p>
            <h2 style={styles.cardTitle}>서비스 목적에 맞춘 입력 UI</h2>
            <p style={styles.sideText}>
              localhost에서 보이던 드래그 기반 컴포넌트를 서비스용 레퍼런스로 옮겼습니다. 현재 상세
              화면에서 동일한 시각 언어로 참여/수정 인터랙션을 확장할 수 있습니다.
            </p>
            <p style={styles.sideText}>
              실제 PATCH 연동은 이벤트의 RRULE 제약을 만족하는 선택 패턴과 함께 연결되어야 하므로, 이
              화면에서는 먼저 정보 구조와 입력 경험을 정리합니다.
            </p>
          </aside>
        </section>

        {panelOpen ? (
          <section style={styles.panelCard}>
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.cardEyebrow}>Participation</p>
                <h2 style={styles.cardTitle}>가능 시간 입력 레퍼런스</h2>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>이름</span>
                <input style={styles.fieldInput} placeholder="예: 홍길동" />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>비밀번호(선택)</span>
                <input style={styles.fieldInput} type="password" placeholder="필요한 경우만 입력" />
              </label>
            </div>

            <AvailabilityComposer
              eyebrow="Schedule Input"
              title="가능 시간을 시각적으로 입력하는 방식"
              description="이 컴포넌트는 localhost에서 보이던 입력 경험을 서비스 목적에 맞는 상세 화면 안으로 옮긴 버전입니다."
              summaryTitle="선택 요약"
              emptySummaryText="아직 선택된 가능 시간이 없습니다."
            />
          </section>
        ) : null}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px 20px 72px",
    background:
      "linear-gradient(180deg, rgba(231,238,252,0.9) 0%, rgba(255,255,255,1) 34%), radial-gradient(circle at top left, rgba(244,226,210,0.65), transparent 28%)",
  },
  shell: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gap: 24,
  },
  centerCard: {
    maxWidth: 720,
    margin: "80px auto 0",
    padding: 28,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #dfe5ef",
    textAlign: "center",
  },
  centerTitle: {
    margin: 0,
    fontSize: 32,
    color: "#152847",
  },
  centerText: {
    margin: "12px 0 0",
    color: "#53627b",
  },
  headerCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    padding: 28,
    borderRadius: 28,
    background: "#13233f",
    color: "#f8fbff",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#b7c6e5",
  },
  headerTitle: {
    margin: "10px 0 12px",
    fontSize: "clamp(2rem, 4vw, 3.5rem)",
    lineHeight: 1.04,
  },
  headerText: {
    margin: "6px 0 0",
    color: "#d7e0f0",
  },
  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  primaryButton: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: 999,
    border: 0,
    background: "#f7f9ff",
    color: "#0f3d91",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "transparent",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  metricCard: {
    padding: 20,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #dfe5ef",
  },
  metricLabel: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#5a7095",
  },
  metricValue: {
    display: "block",
    marginTop: 10,
    fontSize: 24,
    color: "#13233f",
  },
  bodyGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
    gap: 20,
  },
  membersCard: {
    padding: 24,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #dfe5ef",
  },
  sideCard: {
    padding: 24,
    borderRadius: 26,
    background: "#f6f8fc",
    border: "1px solid #dfe5ef",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  cardEyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#5a7095",
  },
  cardTitle: {
    margin: "10px 0 0",
    fontSize: 28,
    color: "#152847",
  },
  memberList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gap: 12,
  },
  memberItem: {
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e1e7f1",
  },
  memberName: {
    color: "#172b4b",
  },
  memberRule: {
    margin: "8px 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#56657e",
    wordBreak: "break-all",
  },
  emptyText: {
    color: "#56657e",
    lineHeight: 1.7,
  },
  sideText: {
    margin: "12px 0 0",
    lineHeight: 1.7,
    color: "#53627b",
  },
  panelCard: {
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #dfe5ef",
  },
  panelHeader: {
    marginBottom: 16,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 12,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  fieldLabel: {
    fontWeight: 700,
    color: "#172b4b",
  },
  fieldInput: {
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid #cad3e2",
    padding: "0 14px",
  },
};
