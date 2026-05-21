# J/Z Classifier Evaluation

## Model

- Architecture: BiLSTM (hidden=64, layers=2, bidirectional)
- Input: (30, 126) normalized landmark sequences
- Classes: 2 (J, Z)
- Parameters: 182,402

## Results

- Test accuracy: 1.0000
- Training samples: 1280
- Test samples: 320

### Classification Report

```
              precision    recall  f1-score   support

           J       1.00      1.00      1.00       160
           Z       1.00      1.00      1.00       160

    accuracy                           1.00       320
   macro avg       1.00      1.00      1.00       320
weighted avg       1.00      1.00      1.00       320

```

### Confusion Matrix

```
[[160   0]
 [  0 160]]
```
