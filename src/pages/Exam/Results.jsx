// pages/Results.jsx or wherever you render the list
import React, { useEffect, useState } from "react";
import TestCard from "./TestCard";
import { getDatabase, ref, get, child } from "firebase/database";

import { database } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";


const Results = () => {
    const [tests, setTests] = useState([]);
    const [filteredTests, setFilteredTests] = useState([]);

    const navigate = useNavigate();

    const { user } = useAuth();


    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            const dbRef = ref(database);
            const snapshot = await get(child(dbRef, "Exam"));

            if (snapshot.exists()) {
                const data = snapshot.val();

                const dataArray = Object.entries(data).map(([id, value]) => ({ id, ...value }));

                console.log("All exams:", dataArray);
                console.log("User email:", user?.email);

                console.log(dataArray);

                // ✅ Filter: Only eligible AND completed exams
                const filtered = dataArray.filter(test =>
                    Array.isArray(Object.values(test.Eligible || {} )) &&
                    Object.values(test.Eligible || {} ).includes(user?.email) &&
                    (test.Properties.status === "Completed")
                );

                console.log("Eligible & Completed:", filtered);

                setTests(dataArray);         // All exams (if needed elsewhere)
                setFilteredTests(filtered);  // Filtered list for display
            } else {
                console.log("No data available");
            }
        } catch (error) {
            console.error("Error loading mock exams from Firebase:", error);
        }
    };


    const handleStartTest = (testId) => {
        console.log("Start test with ID:", testId);
        navigate(`/examwindow/${testId}`);
        // navigate to test page, or set state
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTests.length > 0 ? (
                filteredTests.map((test) => (
                    <TestCard key={test.id} test={test} onStart={handleStartTest} />
                ))
            ) : (
                <div className="col-span-3 text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">
                        No tests found. Create a new test to get started.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Results;
