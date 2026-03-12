import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
  data,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  Link,
} from "react-router";
import { prisma } from "~/lib/db.server";

export async function loader({}: LoaderFunctionArgs) {
  const [users, matches] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.match.findMany({
      where: {
        status: "SCHEDULED",
      },
      orderBy: {
        startTime: "asc",
      },
      include: {
        tournament: true,
        round: true,
        homeTeam: true,
        awayTeam: true,
      },
    }),
  ]);

  return data({ users, matches });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const userId = String(formData.get("userId") || "");
  const accessCode = String(formData.get("accessCode") || "").trim();
  const matchId = String(formData.get("matchId") || "");
  const predictedHomeRaw = String(formData.get("predictedHome") || "");
  const predictedAwayRaw = String(formData.get("predictedAway") || "");

  if (!userId || !accessCode || !matchId || predictedHomeRaw === "" || predictedAwayRaw === "") {
    return data(
      { error: "Заповни всі поля форми" },
      { status: 400 }
    );
  }

  const predictedHome = Number(predictedHomeRaw);
  const predictedAway = Number(predictedAwayRaw);

  if (Number.isNaN(predictedHome) || Number.isNaN(predictedAway)) {
    return data(
      { error: "Рахунок має бути числом" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return data(
      { error: "Користувача не знайдено" },
      { status: 404 }
    );
  }

  if (user.accessCode !== accessCode) {
    return data(
      { error: "Неправильний код доступу" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    return data(
      { error: "Матч не знайдено" },
      { status: 404 }
    );
  }

  if (match.status !== "SCHEDULED") {
    return data(
      { error: "На цей матч уже не можна зробити прогноз" },
      { status: 400 }
    );
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

  return redirect("/predict?success=1");
}

export default function PredictPage() {
  const { users, matches } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.22),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_22%),linear-gradient(to_bottom,#0a0a0a,#111827,#0a0a0a)]" />
        <Link
            to="/"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 sm:w-auto"
        >
            Повернутися на головну
        </Link>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">
              Match Predictor
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Зробити прогноз
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">
              Обери себе, введи свій код і постав рахунок на матч.
            </p>
          </div>

          {actionData?.error && (
            <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {actionData.error}
            </div>
          )}

          <Form method="post" className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">
                Хто ти?
              </label>
              <select
                name="userId"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-white/25"
                required
              >
                <option value="" className="text-black">
                  Обери себе
                </option>
                {users.map((user) => (
                  <option key={user.id} value={user.id} className="text-black">
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">
                Код доступу
              </label>
              <input
                name="accessCode"
                type="password"
                placeholder="Введи свій код"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-white/35 outline-none focus:border-white/25"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">
                Матч
              </label>
              <select
                name="matchId"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-white/25"
                required
              >
                <option value="" className="text-black">
                  Обери матч
                </option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id} className="text-black">
                    {match.homeTeam.name} vs {match.awayTeam.name} —{" "}
                    {new Date(match.startTime).toLocaleString("uk-UA")}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Голів 1
                </label>
                <input
                  name="predictedHome"
                  type="number"
                  min="0"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-white/25"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Голів 2
                </label>
                <input
                  name="predictedAway"
                  type="number"
                  min="0"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-white/25"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Збереження..." : "Зберегти прогноз"}
            </button>
          </Form>
        </div>

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
          <h2 className="text-xl font-black">Доступні матчі</h2>

          <div className="mt-4 space-y-3">
            {matches.length > 0 ? (
              matches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                    {match.tournament.name}
                    {match.round ? ` · ${match.round.name}` : ""}
                  </div>

                  <div className="mt-2 text-lg font-black">
                    {match.homeTeam.name} <span className="text-white/35">vs</span>{" "}
                    {match.awayTeam.name}
                  </div>

                  <div className="mt-2 text-sm text-white/60">
                    {new Date(match.startTime).toLocaleString("uk-UA")}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Поки що немає доступних матчів для прогнозу.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}