import {
  Link,
  useLoaderData,
  data,
  type LoaderFunctionArgs,
} from "react-router";
import { prisma } from "~/lib/db.server";

function getResultLabel(home: number | null, away: number | null) {
  if (home === null || away === null) return "Очікується";
  if (home > away) return "Перемога господарів";
  if (home < away) return "Перемога гостей";
  return "Нічия";
}

function getStatusLabel(status: string) {
  switch (status) {
    case "SCHEDULED":
      return "Скоро";
    case "LIVE":
      return "LIVE";
    case "FINISHED":
      return "Завершено";
    case "CANCELED":
      return "Скасовано";
    default:
      return status;
  }
}

export async function loader({}: LoaderFunctionArgs) {
  const [matches, users, teams, tournaments, leaderboardRaw] = await Promise.all([
    prisma.match.findMany({
      orderBy: { startTime: "desc" },
      include: {
        tournament: true,
        round: true,
        homeTeam: true,
        awayTeam: true,
        predictions: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      take: 50,
    }),
    prisma.user.findMany({
      include: {
        predictions: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.team.count(),
    prisma.tournament.count(),
    prisma.user.findMany({
      include: {
        predictions: true,
      },
    }),
  ]);

  const leaderboard = leaderboardRaw
    .map((user) => {
      const totalPoints = user.predictions.reduce(
        (sum, prediction) => sum + prediction.pointsAwarded,
        0
      );

      const exactHits = user.predictions.filter(
        (prediction) => prediction.pointsAwarded === 3
      ).length;

      const correctResults = user.predictions.filter(
        (prediction) => prediction.pointsAwarded >= 1
      ).length;

      return {
        id: user.id,
        name: user.name,
        totalPoints,
        exactHits,
        correctResults,
        predictionsCount: user.predictions.length,
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
      if (b.correctResults !== a.correctResults) {
        return b.correctResults - a.correctResults;
      }
      return a.name.localeCompare(b.name, "uk");
    });

  const now = new Date();

  const liveMatches = matches.filter((match) => {
    if (match.status === "LIVE") return true;

    if (
      match.status === "SCHEDULED" &&
      new Date(match.startTime) <= now &&
      match.homeScore === null &&
      match.awayScore === null
    ) {
      return true;
    }

    return false;
  });

  const upcomingMatches = matches
    .filter(
      (match) =>
        match.status === "SCHEDULED" && new Date(match.startTime) > now
    )
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

  const finishedMatches = matches
    .filter((match) => match.status === "FINISHED")
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

  const matchesWithPredictions = matches.filter(
    (match) => match.predictions.length > 0
  );

  return data({
    matches,
    liveMatches,
    upcomingMatches,
    finishedMatches,
    matchesWithPredictions,
    leaderboard,
    stats: {
      users: users.length,
      teams,
      tournaments,
      matches: matches.length,
    },
  });
}

export default function HomePage() {
  const {
    liveMatches,
    upcomingMatches,
    finishedMatches,
    matchesWithPredictions,
    leaderboard,
    stats,
  } = useLoaderData<typeof loader>();

  const heroMatch =
    liveMatches[0] ?? upcomingMatches[0] ?? finishedMatches[0] ?? null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.22),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_22%),linear-gradient(to_bottom,#0a0a0a,#111827,#0a0a0a)]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 md:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/45 sm:text-xs">
              Match Predictor League
            </div>
            <h1 className="mt-1 pr-2 text-xl font-black tracking-tight sm:text-2xl md:text-3xl">
              Прогнози на матчі між друзями
            </h1>
          </div>

          <div className="flex w-full sm:w-auto">
            <Link
              to="/predict"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 sm:w-auto"
            >
              Зробити прогноз
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <section className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:rounded-[2rem] sm:p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200 sm:text-xs">
                Власна ліга прогнозів
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60 sm:text-xs">
                Ліга чемпіонів та топ-матчі
              </span>
            </div>

            <h2 className="max-w-3xl text-[2rem] font-black leading-[1.05] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Вгадайте рахунок. Збирайте бали. Визначайте головного футбольного експерта компанії.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:mt-5 sm:text-base sm:leading-7 md:text-lg">
              Тут видно майбутні матчі, поточні матчі, результати, прогнози
              учасників і загальну турнірну таблицю. Усе в одному місці —
              красиво, швидко і без хаосу.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:rounded-3xl sm:p-4">
                <div className="text-xs text-white/50 sm:text-sm">Учасників</div>
                <div className="mt-1 text-2xl font-black sm:mt-2 sm:text-3xl">
                  {stats.users}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:rounded-3xl sm:p-4">
                <div className="text-xs text-white/50 sm:text-sm">Команд</div>
                <div className="mt-1 text-2xl font-black sm:mt-2 sm:text-3xl">
                  {stats.teams}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:rounded-3xl sm:p-4">
                <div className="text-xs text-white/50 sm:text-sm">Турнірів</div>
                <div className="mt-1 text-2xl font-black sm:mt-2 sm:text-3xl">
                  {stats.tournaments}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:rounded-3xl sm:p-4">
                <div className="text-xs text-white/50 sm:text-sm">Матчів</div>
                <div className="mt-1 text-2xl font-black sm:mt-2 sm:text-3xl">
                  {stats.matches}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-blue-500/20 via-white/5 to-violet-500/20 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:rounded-[2rem] sm:p-6 md:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50 sm:text-sm">
              Матч у фокусі
            </div>

            {heroMatch ? (
              <>
                <div className="mt-5 flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
                  <span className="break-words">{heroMatch.tournament.name}</span>
                  <span>{heroMatch.round?.name ?? "Без раунду"}</span>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
                    <div className="text-sm text-white/55 sm:text-base md:text-lg">
                      Домашні
                    </div>
                    <div className="mt-1 break-words text-2xl font-black sm:mt-2 sm:text-3xl md:text-4xl">
                      {heroMatch.homeTeam.name}
                    </div>
                  </div>

                  <div className="mx-auto rounded-2xl border border-white/10 bg-black/25 px-5 py-3 text-lg font-black sm:rounded-3xl sm:px-5 sm:py-4 sm:text-xl">
                    {heroMatch.homeScore !== null && heroMatch.awayScore !== null
                      ? `${heroMatch.homeScore}:${heroMatch.awayScore}`
                      : "VS"}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center sm:border-0 sm:bg-transparent sm:p-0 sm:text-left">
                    <div className="text-sm text-white/55 sm:text-base md:text-lg">
                      Гості
                    </div>
                    <div className="mt-1 break-words text-2xl font-black sm:mt-2 sm:text-3xl md:text-4xl">
                      {heroMatch.awayTeam.name}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 sm:mt-8 sm:rounded-3xl">
                  <div className="text-sm text-white/55">Статус</div>
                  <div className="mt-3 flex flex-col gap-3 sm:mt-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-semibold">
                      {getStatusLabel(heroMatch.status)}
                    </span>
                    <span className="text-sm leading-6 text-white/65">
                      {new Date(heroMatch.startTime).toLocaleString("uk-UA")}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-sm text-white/60 sm:mt-8 sm:rounded-3xl sm:p-8 sm:text-base">
                Поки що матчів немає. Додай їх через адмін-панель.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:mt-8 sm:rounded-[2rem] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45 sm:text-sm sm:tracking-[0.2em]">
                Поточні матчі
              </div>
              <h3 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl">
                Зараз у фокусі
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {liveMatches.length > 0 ? (
              liveMatches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 sm:rounded-3xl sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 sm:text-xs sm:tracking-[0.2em]">
                        {match.tournament.name}
                        {match.round ? ` · ${match.round.name}` : ""}
                      </div>
                      <div className="mt-2 break-words text-lg font-black leading-tight sm:text-xl">
                        {match.homeTeam.name} <span className="text-white/35">vs</span>{" "}
                        {match.awayTeam.name}
                      </div>
                    </div>

                    <div className="w-fit rounded-2xl border border-red-400/20 bg-red-400/15 px-4 py-2 text-sm font-black text-red-200">
                      LIVE
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {match.predictions.length > 0 ? (
                      match.predictions.map((prediction) => (
                        <div
                          key={prediction.id}
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm"
                        >
                          <span className="font-semibold">{prediction.user.name}</span>:{" "}
                          {prediction.predictedHome}:{prediction.predictedAway}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 sm:text-sm">
                        Поки що прогнозів немає
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60 sm:rounded-3xl sm:p-6 sm:text-base">
                Поточних матчів зараз немає.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:mt-8 lg:gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:rounded-[2rem] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45 sm:text-sm sm:tracking-[0.2em]">
                  Лідери сезону
                </div>
                <h3 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl">
                  Турнірна таблиця
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {leaderboard.length > 0 ? (
                leaderboard.map((player, index) => (
                  <div
                    key={player.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 sm:gap-4 sm:rounded-3xl sm:px-4 sm:py-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-xs font-black sm:h-11 sm:w-11 sm:text-sm">
                      #{index + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold sm:text-base md:text-lg">
                        {player.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55 sm:text-sm">
                        <span>Точних: {player.exactHits}</span>
                        <span>Результатів: {player.correctResults}</span>
                        <span>Прогнозів: {player.predictionsCount}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 sm:text-xs sm:tracking-[0.2em]">
                        Бали
                      </div>
                      <div className="mt-1 text-xl font-black sm:text-2xl">
                        {player.totalPoints}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60 sm:rounded-3xl sm:p-6 sm:text-base">
                  Поки що немає учасників або прогнозів.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:rounded-[2rem] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45 sm:text-sm sm:tracking-[0.2em]">
                  Найближчі матчі
                </div>
                <h3 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl">
                  На що зараз ставлять
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              {upcomingMatches.length > 0 ? (
                upcomingMatches.slice(0, 6).map((match) => (
                  <div
                    key={match.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:rounded-3xl sm:p-5"
                  >
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 sm:text-xs sm:tracking-[0.2em]">
                          {match.tournament.name}
                          {match.round ? ` · ${match.round.name}` : ""}
                        </div>
                        <div className="mt-2 break-words text-lg font-black leading-tight sm:text-xl md:text-2xl">
                          {match.homeTeam.name} <span className="text-white/35">vs</span>{" "}
                          {match.awayTeam.name}
                        </div>
                      </div>

                      <div className="w-fit rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 sm:px-4">
                        {new Date(match.startTime).toLocaleString("uk-UA")}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {match.predictions.length > 0 ? (
                        match.predictions.slice(0, 4).map((prediction) => (
                          <div
                            key={prediction.id}
                            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 sm:text-sm"
                          >
                            <span className="font-semibold">{prediction.user.name}</span>:{" "}
                            {prediction.predictedHome}:{prediction.predictedAway}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 sm:text-sm">
                          Поки що прогнозів немає
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60 sm:rounded-3xl sm:p-6 sm:text-base">
                  Найближчих матчів зараз немає.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:mt-8 sm:rounded-[2rem] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45 sm:text-sm sm:tracking-[0.2em]">
                Усі прогнози
              </div>
              <h3 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl">
                Хто що поставив
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            {matchesWithPredictions.length > 0 ? (
              matchesWithPredictions.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:rounded-3xl sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 sm:text-xs sm:tracking-[0.2em]">
                        {match.tournament.name}
                        {match.round ? ` · ${match.round.name}` : ""}
                      </div>
                      <div className="mt-2 break-words text-lg font-black leading-tight sm:text-xl">
                        {match.homeTeam.name} <span className="text-white/35">vs</span>{" "}
                        {match.awayTeam.name}
                      </div>
                      <div className="mt-2 text-sm text-white/55">
                        {new Date(match.startTime).toLocaleString("uk-UA")}
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold">
                        {getStatusLabel(match.status)}
                      </span>

                      {match.homeScore !== null && match.awayScore !== null && (
                        <span className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-black text-emerald-200">
                          Результат: {match.homeScore}:{match.awayScore}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {match.predictions.map((prediction) => (
                      <div
                        key={prediction.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold sm:text-base">
                            {prediction.user.name}
                          </div>
                          <div className="text-xs text-white/50 sm:text-sm">
                            Прогноз на матч
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-black sm:text-base">
                            {prediction.predictedHome}:{prediction.predictedAway}
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 sm:text-xs">
                              Бали
                            </div>
                            <div className="text-sm font-black sm:text-base">
                              {prediction.pointsAwarded}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60 sm:rounded-3xl sm:p-6 sm:text-base">
                Поки що прогнозів немає.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:mt-8 sm:rounded-[2rem] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45 sm:text-sm sm:tracking-[0.2em]">
                Завершені матчі
              </div>
              <h3 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl">
                Останні результати
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {finishedMatches.length > 0 ? (
              finishedMatches.slice(0, 6).map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:rounded-3xl sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 sm:text-xs sm:tracking-[0.2em]">
                        {match.tournament.name}
                        {match.round ? ` · ${match.round.name}` : ""}
                      </div>
                      <div className="mt-2 break-words text-lg font-black leading-tight sm:text-xl">
                        {match.homeTeam.name} <span className="text-white/35">vs</span>{" "}
                        {match.awayTeam.name}
                      </div>
                    </div>

                    <div className="w-fit rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-lg font-black text-emerald-200">
                      {match.homeScore}:{match.awayScore}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
                    <span>{getResultLabel(match.homeScore, match.awayScore)}</span>
                    <span>{new Date(match.startTime).toLocaleString("uk-UA")}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {match.predictions.length > 0 ? (
                      match.predictions.slice(0, 4).map((prediction) => (
                        <div
                          key={prediction.id}
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm"
                        >
                          <span className="font-semibold">{prediction.user.name}</span>:{" "}
                          {prediction.predictedHome}:{prediction.predictedAway} ·{" "}
                          {prediction.pointsAwarded} б.
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 sm:text-sm">
                        Ніхто ще не голосував
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60 sm:rounded-3xl sm:p-6 sm:text-base">
                Завершених матчів поки що немає.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}