import axios from 'axios';

const API_BASE_URL = 'https://vylop.onrender.com';

/**
 * Runs the code against all test cases for a given problem.
 */
export const evaluateSubmission = async (problem, activeFile, language, code, fileData, envVars) => {
    let passedCount = 0;
    const totalCases = problem.testcases.length;
    const startTime = performance.now();
    let failedCase = null;
    let actualFailOutput = "";

    for (const tc of problem.testcases) {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/execute`, {
                language: language || "plaintext",
                code: code,
                input: tc.rawInput,
                mainFile: activeFile,
                files: fileData,
                envVars: envVars
            }, { transformResponse: [(data) => data] });

            const out = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            const cleanOut = out.trim();
            const cleanExpected = tc.expectedOutput.trim();

            if (cleanOut === cleanExpected) {
                passedCount++;
            } else {
                failedCase = tc;
                actualFailOutput = cleanOut;
                break; // Stop evaluating on the first failed test case
            }
        } catch (error) {
            return {
                status: 'ERROR',
                details: "Execution failed or timed out on test case: " + tc.name
            };
        }
    }

    const endTime = performance.now();
    const execTime = Math.round(endTime - startTime);

    if (passedCount === totalCases) {
        return { status: 'ACCEPTED', passed: passedCount, total: totalCases, time: execTime };
    } else {
        return {
            status: 'WRONG_ANSWER',
            passed: passedCount,
            total: totalCases,
            failedOn: failedCase,
            actualOutput: actualFailOutput,
            time: execTime
        };
    }
};