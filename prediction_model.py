# -*- coding: utf-8 -*-
"""
Created on Thu Jan 13 12:07:58 2022

@author: Arun Kumar
"""
import pandas as pd
from sklearn import linear_model
from sklearn.model_selection import train_test_split
import sys
import json

# get parameters from command line
json_file = sys.argv[1]
stock_price = int(sys.argv[2])
no_of_days = int(sys.argv[3])

# extracting data
df = pd.read_json(json_file)

#keeping only adjusted closing price
df = df[['close']]

#finding moving avrage for n number of days
df['EMA'] = df['close'].ewm(span = no_of_days).mean()
df = df.iloc[10:]

#splitting data
x_train, x_test, y_train, y_test = train_test_split(df[['close']], df.EMA, train_size = 0.7)

#training model
price = linear_model.LinearRegression()
price.fit(x_train, y_train)

#finding accuracy of the model
predicted_price = float('{:.3f}'.format(price.predict([[stock_price]])[0]))

score = price.score(x_test,y_test)
predicted_accuracy = float('{:.1f}'.format(score*100))

print(json.dumps([predicted_price, predicted_accuracy]))