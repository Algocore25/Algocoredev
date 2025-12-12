# Violation Logging System

## Overview
The FullscreenTracker now logs all violation reasons to Firebase Realtime Database with detailed context for audit trails and analysis.

## Firebase Structure

```
Exam/
  └── {testId}/
      └── Violations/
          └── {userId}/
              └── {violationId}/ (auto-generated)
                  ├── reason: string
                  ├── timestamp: ISO string
                  ├── userAgent: string
                  ├── screenSize: string
                  ├── windowSize: string
                  └── details: object
```

## Violation Types

### 1. **fullscreen_exit**
Triggered when user exits fullscreen mode

**Details logged:**
- `exitTime`: ISO timestamp when exit occurred
- `gracePeriod`: "1000ms"

**Example:**
```json
{
  "reason": "fullscreen_exit",
  "timestamp": "2025-10-16T15:30:45.123Z",
  "userAgent": "Mozilla/5.0...",
  "screenSize": "1920x1080",
  "windowSize": "1920x1080",
  "details": {
    "exitTime": "2025-10-16T15:30:45.123Z",
    "gracePeriod": "1000ms"
  }
}
```

### 2. **window_blur**
Triggered when window loses focus for >2 seconds

**Details logged:**
- `duration`: Total blur duration in milliseconds
- `gracePeriod`: "2000ms"
- `hasFocus`: Boolean indicating focus state

**Example:**
```json
{
  "reason": "window_blur",
  "timestamp": "2025-10-16T15:32:10.456Z",
  "details": {
    "duration": "3500ms",
    "gracePeriod": "2000ms",
    "hasFocus": false
  }
}
```

### 3. **tab_switch**
Triggered when user switches tabs or page becomes hidden for >2 seconds

**Details logged:**
- `duration`: Total hidden duration in milliseconds
- `gracePeriod`: "2000ms"
- `pageHidden`: Boolean indicating hidden state
- `visibilityState`: Document visibility state

**Example:**
```json
{
  "reason": "tab_switch",
  "timestamp": "2025-10-16T15:33:22.789Z",
  "details": {
    "duration": "4200ms",
    "gracePeriod": "2000ms",
    "pageHidden": true,
    "visibilityState": "hidden"
  }
}
```

### 4. **mouse_leave**
Triggered when mouse leaves viewport for >2 seconds

**Details logged:**
- `duration`: Total time outside viewport in milliseconds
- `gracePeriod`: "2000ms"
- `lastPosition`: Object with x,y coordinates

**Example:**
```json
{
  "reason": "mouse_leave",
  "timestamp": "2025-10-16T15:34:30.012Z",
  "details": {
    "duration": "5100ms",
    "gracePeriod": "2000ms",
    "lastPosition": {
      "x": 1925,
      "y": 540
    }
  }
}
```

## Context Data (all violations)

All violations include:
- **userAgent**: Browser/OS information for debugging
- **screenSize**: Physical screen resolution (e.g., "1920x1080")
- **windowSize**: Browser window dimensions (e.g., "1920x937")

## Usage Examples

### Query all violations for a student:
```javascript
const violationsRef = ref(database, `Exam/${testId}/Violations/${userId}`);
const snapshot = await get(violationsRef);
const violations = snapshot.val(); // Returns all violations
```

### Count violation types:
```javascript
const violations = snapshot.val();
const counts = {};

Object.values(violations).forEach(v => {
  counts[v.reason] = (counts[v.reason] || 0) + 1;
});

// Result: { fullscreen_exit: 2, tab_switch: 1, mouse_leave: 1 }
```

### Filter by time range:
```javascript
const recentViolations = Object.values(violations).filter(v => {
  const time = new Date(v.timestamp);
  const cutoff = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
  return time > cutoff;
});
```

### Analyze patterns:
```javascript
// Find violations within 30 seconds of each other
const violations = Object.values(violationsData).sort((a, b) => 
  new Date(a.timestamp) - new Date(b.timestamp)
);

for (let i = 1; i < violations.length; i++) {
  const timeDiff = new Date(violations[i].timestamp) - new Date(violations[i-1].timestamp);
  if (timeDiff < 30000) {
    console.log('Rapid violations detected:', violations[i-1], violations[i]);
  }
}
```

## Admin Dashboard Integration

You can create an admin view to:
1. **View violation timeline** per student
2. **Identify patterns** (e.g., student switching tabs frequently)
3. **Filter false positives** (e.g., violations during legitimate actions)
4. **Generate reports** with violation breakdowns
5. **Review context** (browser, screen size) to understand issues

## Benefits

✅ **Audit trail** - Complete record of all violations  
✅ **Context-aware** - Understand why violation occurred  
✅ **Debugging** - Identify false positives with browser/screen info  
✅ **Analytics** - Pattern detection and reporting  
✅ **Fair evaluation** - Review violations before taking action  

## Security Considerations

- Violations are stored per-user, preventing cross-user data leakage
- Only admins should have read access to violation logs
- Consider GDPR compliance when storing user agent data
- Set Firebase Security Rules appropriately:

```json
{
  "rules": {
    "Exam": {
      "$testId": {
        "Violations": {
          "$userId": {
            ".read": "auth.uid === $userId || root.child('users').child(auth.uid).child('role').val() === 'admin'",
            ".write": "auth.uid === $userId"
          }
        }
      }
    }
  }
}
```
