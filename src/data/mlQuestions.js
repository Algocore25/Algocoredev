export const mlQuestions = [
    {
        id: 'linear-regression',
        title: 'Linear Regression',
        description: `
# Linear Regression Challenge

Linear regression is the "Hello World" of Machine Learning. Your task is to fit a line to a dataset.

## Instructions
1.  Load the dataset using \`numpy\`.
2.  Implement a simple linear regression using \`np.polyfit\` or manual calculation.
3.  Plot the original points and your best fit line.

## Data
X = [1, 2, 3, 4, 5]
Y = [3, 5, 4, 6, 8]
    `,
        initialCode: `# Linear Regression Exercise
import numpy as np
import matplotlib.pyplot as plt

# Data
x = np.array([1, 2, 3, 4, 5])
y = np.array([3, 5, 4, 6, 8])

# TODO: Calculate slope (m) and intercept (c)
# Hint: You can use np.polyfit(x, y, 1)

# Plotting
plt.scatter(x, y, color='blue', label='Data Points')
# plt.plot(x, m*x + c, color='red', label='Best Fit')
plt.legend()
plt.show()`
    },
    {
        id: 'multilinear-regression',
        title: 'Multilinear Regression',
        description: `
# Multilinear Regression

Predict a value based on multiple input variables. 

## Scenario
Predict house price based on **Size** and **Age**.

Price = 100 * Size + 10 * (2025 - YearBuilt)
    `,
        initialCode: `# Multilinear Regression
import numpy as np

# Features: [Size (1000sqft), YearBuilt]
X = np.array([
    [1.5, 2010],
    [2.0, 2015],
    [1.0, 2005],
    [3.0, 2020]
])

# Target: Price ($k)
y = np.array([300, 450, 200, 600])

# TODO: Fit a model to predict price for a house with Size=2.5, Year=2018
`
    },
    {
        id: 'kmeans-clustering',
        title: 'K-Means Clustering',
        description: `
# K-Means Clustering

Group data points into K clusters.

## Instructions
1.  Generate random data points using \`np.random\`.
2.  Use a simple K-means logic or just visualize different clusters manually for now.
    `,
        initialCode: `# K-Means Clustering Visualization
import numpy as np
import matplotlib.pyplot as plt

# Generate random data
data = np.random.rand(50, 2)

# TODO: Implement K-Means or visualize clusters
plt.scatter(data[:, 0], data[:, 1])
plt.title("Random Data")
plt.show()
`
    }
];
