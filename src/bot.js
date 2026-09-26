require('dotenv').config();
const { Bot, Keyboard } = require('grammy');
const axios = require('axios');

const bot = new Bot(process.env.BOT_TOKEN);

const DEFAULT_GROUP = process.env.DEFAULT_GROUP || '251-337';

const dayNamesRu = {
  Monday: 'Понедельник',
  Tuesday: 'Вторник',
  Wednesday: 'Среда',
  Thursday: 'Четверг',
  Friday: 'Пятница',
  Saturday: 'Суббота',
  Sunday: 'Воскресенье',
};

const dayMap = {
  'Пн': 'Monday',
  'Вт': 'Tuesday',
  'Ср': 'Wednesday',
  'Чт': 'Thursday',
  'Пт': 'Friday',
  'Сб': 'Saturday',
};

async function fetchSchedule(group) {
  const token = process.env.MOSPOLY_TOKEN;
  const url = `https://e.mospolytech.ru/old/lk_api.php/?getSchedule&group=${group}&token=${token}`;
  const { data } = await axios.get(url);
  return data;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDay(dayData, dayName) {
  const ruName = dayNamesRu[dayName] || dayName;

  if (!dayData || !dayData.lessons || dayData.lessons.length === 0) {
    return `📅 <b>${ruName}</b>\n\nПар нет 🎉`;
  }

  let text = `📅 <b>${ruName}</b>\n\n`;

  dayData.lessons.forEach((lesson, i) => {
    text += `<b>${i + 1}. ${escapeHtml(lesson.name)}</b>\n`;
    text += `🕐 ${escapeHtml(lesson.timeInterval)}\n`;

    if (lesson.place) {
      text += `📍 ${escapeHtml(lesson.place)}`;
      if (lesson.rooms && lesson.rooms.length > 0) {
        text += `, ауд. ${escapeHtml(lesson.rooms.join(', '))}`;
      }
      text += '\n';
    }

    if (lesson.teachers && lesson.teachers[0]) {
      text += `👤 ${escapeHtml(lesson.teachers.join(', '))}\n`;
    }

    if (lesson.link) {
      text += `🔗 <a href="${lesson.link}">Ссылка на пару</a>\n`;
    }

    text += '\n';
  });

  return text;
}

function getDaysKeyboard() {
  return new Keyboard()
    .text('Пн')
    .text('Вт')
    .text('Ср')
    .row()
    .text('Чт')
    .text('Пт')
    .text('Сб')
    .resized()
    .persistent();
}

function getTodayName() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

function getTomorrowName() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return days[tomorrow.getDay()];
}

async function sendSchedule(ctx, dayName) {
  try {
    const schedule = await fetchSchedule(DEFAULT_GROUP);
    const text = formatDay(schedule[dayName], dayName);
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: getDaysKeyboard(),
    });
  } catch (err) {
    console.error('Ошибка при загрузке:', err.message);
    if (err.response?.status === 401) {
      await ctx.reply('⚠️ Токен МосПолитеха истёк. Обновите MOSPOLY_TOKEN в .env');
    } else {
      await ctx.reply('Ошибка при загрузке расписания. Попробуйте позже.');
    }
  }
}

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Привет! Я бот с расписанием МосПолитеха.\n\n' +
    'Нажмите день недели на клавиатуре ниже 👇\n\n' +
    'Также доступны команды:\n' +
    '/today — расписание на сегодня\n' +
    '/tomorrow — расписание на завтра\n' +
    '/week — расписание на всю неделю\n' +
    '/help — справка',
    { reply_markup: getDaysKeyboard() }
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '📋 Доступные команды:\n\n' +
    '/start — начать заново\n' +
    '/today — расписание на сегодня\n' +
    '/tomorrow — расписание на завтра\n' +
    '/week — расписание на неделю\n\n' +
    'Или нажмите день недели на клавиатуре ниже.',
    { reply_markup: getDaysKeyboard() }
  );
});

bot.command('today', async (ctx) => {
  await sendSchedule(ctx, getTodayName());
});

bot.command('tomorrow', async (ctx) => {
  await sendSchedule(ctx, getTomorrowName());
});

bot.command('week', async (ctx) => {
  try {
    const schedule = await fetchSchedule(DEFAULT_GROUP);
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const day of order) {
      const text = formatDay(schedule[day], day);
      await ctx.reply(text, { parse_mode: 'HTML' });
    }

    await ctx.reply('Выберите день:', { reply_markup: getDaysKeyboard() });
  } catch (err) {
    console.error('Ошибка:', err.message);
    await ctx.reply('Ошибка при загрузке расписания.');
  }
});

for (const [btnText, dayName] of Object.entries(dayMap)) {
  bot.hears(btnText, async (ctx) => {
    await sendSchedule(ctx, dayName);
  });
}

bot.catch((err) => {
  const e = err.error;
  console.error('=== ГЛОБАЛЬНАЯ ОШИБКА ===');
  console.error('Код:', e?.error_code);
  console.error('Описание:', e?.description);
});

bot.start({
  onStart: async (info) => {
    console.log(`✅ Бот @${info.username} запущен!`);

    await bot.api.setMyCommands([
      { command: 'start', description: 'Начать работу' },
      { command: 'today', description: 'Расписание на сегодня' },
      { command: 'tomorrow', description: 'Расписание на завтра' },
      { command: 'week', description: 'Расписание на неделю' },
      { command: 'help', description: 'Справка' },
    ]);
  },
});
