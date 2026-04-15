import dynamic from "next/dynamic";

const QuizClient = dynamic(() => import("./quiz-client"), { ssr: false });

export default function QuizPage() {
  return <QuizClient />;
}
