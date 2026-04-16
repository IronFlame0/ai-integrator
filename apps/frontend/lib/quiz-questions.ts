export type OpenQuestion = {
  type: "open";
  id: number;
  topic: string;
  question: string;
  keyPoints: string;
};

export type MultipleChoiceQuestion = {
  type: "multiple-choice";
  id: number;
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type QuizQuestion = OpenQuestion | MultipleChoiceQuestion;

export const JS_QUESTIONS: QuizQuestion[] = [
  {
    type: "open",
    id: 1,
    topic: "Замыкания",
    question: "Что такое замыкание (closure) в JavaScript? Объясни своими словами и приведи пример.",
    keyPoints:
      "функция сохраняет доступ к переменным из внешней области видимости (lexical scope) даже после того, как внешняя функция завершила выполнение",
  },
  {
    type: "multiple-choice",
    id: 2,
    topic: "Подъём (Hoisting)",
    question: "Что выведет console.log(x) до объявления переменной: var x = 5?",
    options: ["5", "null", "undefined", "ReferenceError"],
    correctIndex: 2,
    explanation:
      "var-переменные поднимаются (hoisting) в начало области видимости, но инициализируются значением undefined. Поэтому обращение до строки присвоения даёт undefined, а не ошибку.",
  },
  {
    type: "open",
    id: 3,
    topic: "Операторы сравнения",
    question: "В чём разница между == и === в JavaScript? Приведи пример, где они дают разный результат.",
    keyPoints:
      "== выполняет приведение типов (type coercion) перед сравнением, === сравнивает без приведения (strict equality); например, 0 == false → true, но 0 === false → false",
  },
  {
    type: "multiple-choice",
    id: 4,
    topic: "Промисы",
    question: "В каком порядке выведутся A, B, C?\n\nconsole.log('A');\nPromise.resolve().then(() => console.log('B'));\nconsole.log('C');",
    options: ["A, B, C", "A, C, B", "B, A, C", "C, A, B"],
    correctIndex: 1,
    explanation:
      "Синхронный код выполняется первым: A, затем C. Коллбэк Promise.then — микрозадача, которая выполняется после текущего синхронного блока, поэтому B последний.",
  },
  {
    type: "open",
    id: 5,
    topic: "Event Loop",
    question: "Объясни как работает Event Loop в JavaScript. Что такое call stack и task queue?",
    keyPoints:
      "JavaScript однопоточный, call stack выполняет синхронный код, асинхронные колбэки попадают в task queue, event loop перемещает задачи из очереди в стек когда стек пуст; микрозадачи (Promise) имеют приоритет над макрозадачами",
  },
];
