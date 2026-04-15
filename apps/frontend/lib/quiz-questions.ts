export type QuizQuestion = {
  id: number;
  topic: string;
  question: string;
  keyPoints: string;
};

export const JS_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    topic: "Замыкания",
    question: "Что такое замыкание (closure) в JavaScript? Объясни своими словами и приведи пример.",
    keyPoints:
      "функция сохраняет доступ к переменным из внешней области видимости (lexical scope) даже после того, как внешняя функция завершила выполнение",
  },
  {
    id: 2,
    topic: "Операторы сравнения",
    question: "В чём разница между == и === в JavaScript? Приведи пример, где они дают разный результат.",
    keyPoints:
      "== выполняет приведение типов (type coercion) перед сравнением, === сравнивает без приведения (strict equality); например, 0 == false → true, но 0 === false → false",
  },
  {
    id: 3,
    topic: "Event Loop",
    question: "Объясни как работает Event Loop в JavaScript. Что такое call stack и task queue?",
    keyPoints:
      "JavaScript однопоточный, call stack выполняет синхронный код, асинхронные колбэки попадают в task queue, event loop перемещает задачи из очереди в стек когда стек пуст; микрозадачи (Promise) имеют приоритет над макрозадачами",
  },
];
