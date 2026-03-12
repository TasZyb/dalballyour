import {
  Form,
  useLoaderData,
  useNavigation,
  redirect,
  data,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { prisma } from "~/lib/db.server";

function getMatchOutcome(home: number, away: number) {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  realHome: number,
  realAway: number
) {
  if (predictedHome === realHome && predictedAway === realAway) {
    return 3;
  }

  const predictedResult = getMatchOutcome(predictedHome, predictedAway);
  const realResult = getMatchOutcome(realHome, realAway);

  if (predictedResult === realResult) {
    return 1;
  }

  return 0;
}

export async function loader({}: LoaderFunctionArgs) {
  const [teams, users, tournaments, matches] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.tournament.findMany({
      orderBy: { name: "asc" },
    }),
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
            createdAt: "desc",
          },
        },
      },
      take: 20,
    }),
  ]);

  return data({
    teams,
    users,
    tournaments,
    matches,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createMatch") {
    const tournamentId = String(formData.get("tournamentId") || "");
    const roundName = String(formData.get("roundName") || "").trim();
    const homeTeamId = String(formData.get("homeTeamId") || "");
    const awayTeamId = String(formData.get("awayTeamId") || "");
    const startTimeRaw = String(formData.get("startTime") || "");

    if (!tournamentId || !homeTeamId || !awayTeamId || !startTimeRaw) {
      return data(
        { error: "Заповни всі поля для створення матчу" },
        { status: 400 }
      );
    }

    if (homeTeamId === awayTeamId) {
      return data(
        { error: "Команда не може грати сама з собою" },
        { status: 400 }
      );
    }

    let roundId: string | null = null;

    if (roundName) {
      const round = await prisma.round.upsert({
        where: {
          tournamentId_name: {
            tournamentId,
            name: roundName,
          },
        },
        update: {},
        create: {
          tournamentId,
          name: roundName,
        },
      });

      roundId = round.id;
    }

    await prisma.match.create({
      data: {
        tournamentId,
        roundId,
        homeTeamId,
        awayTeamId,
        startTime: new Date(startTimeRaw),
      },
    });

    return redirect("/admin_taras");
  }

    if (intent === "addPrediction") {
    const matchId = String(formData.get("matchId") || "");
    const userId = String(formData.get("userId") || "");
    const predictedHomeRaw = String(formData.get("predictedHome") || "");
    const predictedAwayRaw = String(formData.get("predictedAway") || "");

    if (!matchId || !userId || predictedHomeRaw === "" || predictedAwayRaw === "") {
        return data({ error: "Заповни всі поля для прогнозу" }, { status: 400 });
    }

    const predictedHome = Number(predictedHomeRaw);
    const predictedAway = Number(predictedAwayRaw);

    if (Number.isNaN(predictedHome) || Number.isNaN(predictedAway)) {
        return data({ error: "Рахунок має бути числом" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({
        where: { id: matchId },
    });

    if (!match) {
        return data({ error: "Матч не знайдено" }, { status: 404 });
    }

    await prisma.prediction.upsert({
        where: {
        userId_matchId: {
            userId,
            matchId,
        },
        },
        update: {
        predictedHome,
        predictedAway,
        },
        create: {
        userId,
        matchId,
        predictedHome,
        predictedAway,
        },
    });

    return redirect("/admin_taras");
    }

  if (intent === "saveResult") {
    const matchId = String(formData.get("matchId") || "");
    const homeScoreRaw = String(formData.get("homeScore") || "");
    const awayScoreRaw = String(formData.get("awayScore") || "");
    const status = String(formData.get("status") || "SCHEDULED");

    if (!matchId || homeScoreRaw === "" || awayScoreRaw === "") {
      return data({ error: "Заповни результат матчу" }, { status: 400 });
    }

    const homeScore = Number(homeScoreRaw);
    const awayScore = Number(awayScoreRaw);

    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      return data({ error: "Результат має бути числом" }, { status: 400 });
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        status: status as any,
      },
    });

    if (status === "FINISHED") {
      const predictions = await prisma.prediction.findMany({
        where: { matchId },
      });

      for (const prediction of predictions) {
        const points = calculatePoints(
          prediction.predictedHome,
          prediction.predictedAway,
          homeScore,
          awayScore
        );

        await prisma.prediction.update({
          where: { id: prediction.id },
          data: { pointsAwarded: points },
        });
      }
    }

    return redirect("/admin_taras");
  }

  if (intent === "deletePrediction") {
    const predictionId = String(formData.get("predictionId") || "");

    if (!predictionId) {
      return data(
        { error: "Не знайдено прогноз для видалення" },
        { status: 400 }
      );
    }

    await prisma.prediction.delete({
      where: { id: predictionId },
    });

    return redirect("/admin_taras");
  }

  return data({ error: "Невідома дія" }, { status: 400 });
}

export default function AdminPredictionsPage() {
  const { teams, users, tournaments, matches } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3">
          <span className="w-fit rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Admin panel
          </span>

          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Керування матчами та прогнозами
          </h1>

          <p className="max-w-2xl text-sm text-neutral-600 md:text-base">
            Створюй матчі, додавай прогнози друзів і зберігай результати.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6 xl:col-span-2">
            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">Створити матч</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Усі дані одразу записуються в базу
                </p>
              </div>

              <Form method="post" className="space-y-6">
                <input type="hidden" name="intent" value="createMatch" />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Турнір
                    </label>
                    <select
                      name="tournamentId"
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                      required
                    >
                      <option value="">Оберіть турнір</option>
                      {tournaments.map((tournament) => (
                        <option key={tournament.id} value={tournament.id}>
                          {tournament.name}
                          {tournament.season ? ` (${tournament.season})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Домашня команда
                    </label>
                    <select
                      name="homeTeamId"
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                      required
                    >
                      <option value="">Оберіть команду</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Гостьова команда
                    </label>
                    <select
                      name="awayTeamId"
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                      required
                    >
                      <option value="">Оберіть команду</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Раунд
                    </label>
                    <input
                      name="roundName"
                      type="text"
                      placeholder="Наприклад: 1 тур"
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Дата і час
                    </label>
                    <input
                      name="startTime"
                      type="datetime-local"
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? "Збереження..." : "Зберегти матч"}
                </button>
              </Form>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">Додати прогноз</h2>
              </div>

              <Form method="post" className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <input type="hidden" name="intent" value="addPrediction" />

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Матч
                  </label>
                  <select
                    name="matchId"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                    required
                  >
                    <option value="">Оберіть матч</option>
                    {matches.map((match) => (
                      <option key={match.id} value={match.id}>
                        {match.homeTeam.name} vs {match.awayTeam.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Учасник
                  </label>
                  <select
                    name="userId"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                    required
                  >
                    <option value="">Оберіть учасника</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Голів 1
                  </label>
                  <input
                    name="predictedHome"
                    type="number"
                    min="0"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Голів 2
                  </label>
                  <input
                    name="predictedAway"
                    type="number"
                    min="0"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-neutral-400 focus:bg-white"
                    required
                  />
                </div>

                <div className="flex items-end md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    Додати прогноз
                  </button>
                </div>
              </Form>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">Останні матчі</h2>
              </div>

              <div className="space-y-6">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
                  >
                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-bold">
                          {match.homeTeam.name} — {match.awayTeam.name}
                        </h3>
                        <p className="text-sm text-neutral-500">
                          {match.tournament.name}
                          {match.round ? ` · ${match.round.name}` : ""}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-neutral-700">
                        {new Date(match.startTime).toLocaleString("uk-UA")}
                      </div>
                    </div>

                    <div className="mb-5">
                      <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                        {match.status}
                      </span>
                      {match.homeScore !== null && match.awayScore !== null && (
                        <span className="ml-3 text-sm font-semibold text-neutral-700">
                          Рахунок: {match.homeScore}:{match.awayScore}
                        </span>
                      )}
                    </div>

                    <Form
                      method="post"
                      className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-5"
                    >
                      <input type="hidden" name="intent" value="saveResult" />
                      <input type="hidden" name="matchId" value={match.id} />

                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Голів 1
                        </label>
                        <input
                          name="homeScore"
                          type="number"
                          min="0"
                          defaultValue={match.homeScore ?? ""}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 outline-none focus:border-neutral-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Голів 2
                        </label>
                        <input
                          name="awayScore"
                          type="number"
                          min="0"
                          defaultValue={match.awayScore ?? ""}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 outline-none focus:border-neutral-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Статус
                        </label>
                        <select
                          name="status"
                          defaultValue={match.status}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 outline-none focus:border-neutral-400"
                        >
                          <option value="SCHEDULED">SCHEDULED</option>
                          <option value="LIVE">LIVE</option>
                          <option value="FINISHED">FINISHED</option>
                          <option value="CANCELED">CANCELED</option>
                        </select>
                      </div>

                      <div className="flex items-end md:col-span-2">
                        <button
                          type="submit"
                          className="w-full rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                          Зберегти результат
                        </button>
                      </div>
                    </Form>

                    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
                      <div className="grid grid-cols-4 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-600">
                        <div>Учасник</div>
                        <div>Прогноз</div>
                        <div>Бали</div>
                        <div className="text-right">Дії</div>
                      </div>

                      <div className="divide-y divide-neutral-200">
                        {match.predictions.length > 0 ? (
                          match.predictions.map((prediction) => (
                            <div
                              key={prediction.id}
                              className="grid grid-cols-4 items-center px-4 py-4 text-sm"
                            >
                              <div className="font-medium text-neutral-800">
                                {prediction.user.name}
                              </div>

                              <div>
                                {prediction.predictedHome}:{prediction.predictedAway}
                              </div>

                              <div>{prediction.pointsAwarded}</div>

                              <div className="text-right">
                                <Form method="post">
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="deletePrediction"
                                  />
                                  <input
                                    type="hidden"
                                    name="predictionId"
                                    value={prediction.id}
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                                  >
                                    Видалити
                                  </button>
                                </Form>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-center text-sm text-neutral-500">
                            Поки що прогнозів немає
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">Швидка статистика</h3>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-sm text-neutral-500">Матчів</div>
                  <div className="mt-2 text-2xl font-bold">{matches.length}</div>
                </div>

                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-sm text-neutral-500">Учасників</div>
                  <div className="mt-2 text-2xl font-bold">{users.length}</div>
                </div>

                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-sm text-neutral-500">Команд</div>
                  <div className="mt-2 text-2xl font-bold">{teams.length}</div>
                </div>

                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-sm text-neutral-500">Турнірів</div>
                  <div className="mt-2 text-2xl font-bold">{tournaments.length}</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}