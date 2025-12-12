// pages/AvailableTests.jsx or wherever you render the list
import React, { useEffect, useState  } from "react";
import TestCard from "./TestCard";
import { getDatabase, ref, get, child } from "firebase/database";

import { database } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SkeletonLoader from '../../components/SkeletonLoader';




const AvailableTests = () => {
    const [tests, setTests] = useState([]);
    const [filteredTests, setFilteredTests] = useState([]);
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();

    const {user} = useAuth();


    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
    try {

        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, "Exam"));
        if (snapshot.exists()) {
            const data = snapshot.val();
            const dataArray = Object.values(data); // convert object to array if needed
              // Convert to array with keys (if you need the exam IDs)
            const dataArray2 = Object.entries(data).map(([id, value]) => ({ id, ...value }));

            console.log(dataArray2);
            console.log( user?.email);


            const filtered = dataArray2.filter(test => {
                console.log("Checking test:", Object.values(test.Eligible || {} )); // Print test on every iteration
                return (
                    Array.isArray(Object.values(test.Eligible || {} )) &&
                    Object.values(test.Eligible || {} ).includes(user?.email) &&
                    test.Properties.status?.toLowerCase() !== "completed"
                );
            });
            

            console.log(filtered);

            setTests(dataArray);
            setFilteredTests(filtered);
        } else {
            console.log("No data available");
        }
    } catch (error) {
        console.error("Error loading mock exams from Firebase:", error);
    } finally {
        setLoading(false);
    }
};

    const handleStartTest = (testId) => {
        console.log("Start test with ID:", testId);
        navigate(`/examwindow/${testId}` );
        // navigate to test page, or set state
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
                <>
                    <SkeletonLoader />
                    <SkeletonLoader />
                    <SkeletonLoader />
                </>
            ) : filteredTests.length > 0 ? (
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

export default AvailableTests;
