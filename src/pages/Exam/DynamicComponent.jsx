import React, { useEffect, useState } from "react";
import { ref, onValue, get } from "firebase/database";
import { database } from "../../firebase";
import MCQPage from "./MCQPage";
import CodePage from "./CodePage";
import LoadingPage from "../LoadingPage";




const DynamicComponent = ({ question }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);





  // Fetch question data from Firebase
  useEffect(() => {

    const fetchData = async () => {
      setLoading(true);

      try {
        // Single call for both question data and next question URL
        const questionRef = ref(
          database,
          `questions/${question}`);

        // Get both question data and all questions in parallel
        const [questionSnapshot] = await Promise.all([
          get(questionRef),
        ]);

        console.log(questionSnapshot.val());

        if (questionSnapshot.exists()) {
          const question = questionSnapshot.val();

          console.log(question);
          setData(question);
        }
      } catch (error) {
        console.error("Error fetching data from Firebase:", error);
      } finally {
        setLoading(false);
      }
    };


    console.log(data?.type);

    fetchData();

  }, [question]); // Dependencies adjusted




  if (loading) return <LoadingPage message="Loading question, please wait..." />;

  if (!data) return <p>No data found</p>;

  return (
    <div>
      {data?.type === "Programming" && <CodePage question={question} />}
      {/* {data?.type === "MCQ" && <MCQPage  data= {data} />} */}
      {data?.type === "MCQ" && <MCQPage data={data} />}
      {/* Add more conditional components as needed */}
    </div>
  );
};

export default DynamicComponent;
