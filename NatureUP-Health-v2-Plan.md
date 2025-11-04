# NatureUP Health v2 - Complete Rebuild Plan

## Project Overview

NatureUP Health is a voice-first, mobile health app focused on personalized outdoor excursions and nature therapy. This is a complete ground-up rebuild using modern technologies and best practices.

## Technology Stack

- **Frontend**: Expo SDK 54, React Native, TypeScript, expo-router
- **Backend**: Supabase (authentication, database, edge functions)
- **AI**: OpenAI Assistants API (two assistants: Health Coach & Excursion Creator)
- **Maps**: react-native-maps with Google Maps (iOS & Android), web support via Google Maps JavaScript API
- **Voice**: Full duplex real-time audio streaming
- **Deployment**: EAS for iOS TestFlight builds

## Key Configuration

- **Bundle Identifier**: `com.natureup.health2`
- **Primary Platform**: iOS (production), Web (development preview)
- **Design Theme**: Nature-inspired with green color palette
  - Primary: #4A7C2E
  - Background: #F5F8F3

## Phase 1: Project Initialization

### 1.1 Repository Setup
- [x] Create new GitHub repository for NatureUP Health v2
- [ ] Initialize fresh Expo project with SDK 54
- [ ] Configure TypeScript with strict mode
- [ ] Set up expo-router for file-based navigation
- [ ] Configure app.json with bundle identifier `com.natureup.health2`

### 1.2 Supabase Setup
- [ ] Create new Supabase project
- [ ] Configure secure database password
- [ ] Set up authentication (email/password)
- [ ] Install @supabase/supabase-js client
- [ ] Configure environment variables in .env

### 1.3 Development Environment
- [ ] Configure .gitignore (node_modules, .env, build artifacts)
- [ ] Set up EAS for iOS builds
- [ ] Install core dependencies:
  - expo-router
  - @supabase/supabase-js
  - react-native-url-polyfill
  - lucide-react-native
  - react-native-maps
- [ ] Create initial folder structure:
  ```
  app/
    (tabs)/
    (auth)/
  components/
  lib/
  hooks/
  types/
  ```

### 1.4 Initial Commit
- [ ] Push initial project structure to GitHub
- [ ] Document setup instructions

## Phase 2: Authentication & User Profiles

### 2.1 Database Schema
Create migration for user profiles:
```sql
-- User profiles table
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL,
  first_name text,
  last_name text,
  health_goals text[],
  mobility_level text,
  preferred_activities text[],
  location_preferences jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
```

### 2.2 Authentication Screens
- [ ] Login screen (app/(auth)/login.tsx)
- [ ] Sign up screen (app/(auth)/signup.tsx)
- [ ] Password reset screen (app/(auth)/reset-password.tsx)
- [ ] Auth state management hook (hooks/useAuth.ts)
- [ ] Supabase client configuration (lib/supabase.ts)

### 2.3 Profile Setup
- [ ] Onboarding flow for new users
- [ ] Profile setup screens (multi-step form)
- [ ] Health goals selection
- [ ] Mobility level assessment
- [ ] Activity preferences
- [ ] Location preferences

## Phase 3: Core Navigation & UI

### 3.1 Tab Navigation
- [ ] Root layout (app/_layout.tsx)
- [ ] Tabs layout (app/(tabs)/_layout.tsx)
- [ ] Home tab (app/(tabs)/index.tsx)
- [ ] Excursions tab (app/(tabs)/excursions.tsx)
- [ ] Profile tab (app/(tabs)/profile.tsx)

### 3.2 Shared Components
- [ ] Header component with nature theme
- [ ] Loading states
- [ ] Error boundary
- [ ] Button variants (primary, secondary, outline)
- [ ] Input fields with validation
- [ ] Card components for excursions

### 3.3 Design System
- [ ] Color palette configuration
- [ ] Typography styles
- [ ] Spacing system (8px grid)
- [ ] Icon library integration (lucide-react-native)

## Phase 4: OpenAI Assistants Integration

### 4.1 Supabase Edge Functions
Create two edge functions for AI integration:

**health-coach-assistant**
- [ ] Initialize OpenAI client with API key from secrets
- [ ] Create/retrieve assistant thread per user
- [ ] Handle message streaming
- [ ] Store conversation history in database
- [ ] Return formatted responses

**excursion-creator-assistant**
- [ ] Initialize OpenAI client
- [ ] Pass user context (health goals, mobility, location)
- [ ] Generate personalized excursion plans
- [ ] Integrate weather API data
- [ ] Return structured excursion data

### 4.2 Database Schema for Conversations
```sql
-- Conversations table
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  assistant_type text NOT NULL, -- 'health_coach' or 'excursion_creator'
  thread_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) NOT NULL,
  role text NOT NULL, -- 'user' or 'assistant'
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
```

### 4.3 Client Integration
- [ ] Create API client (lib/assistants-api.ts)
- [ ] Chat interface component (components/ChatInterface.tsx)
- [ ] Message bubble components
- [ ] Typing indicator
- [ ] Error handling for API calls

## Phase 5: Excursion Features

### 5.1 Database Schema for Excursions
```sql
-- Excursions table
CREATE TABLE excursions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text NOT NULL,
  description text,
  location jsonb NOT NULL, -- {lat, lng, address}
  route_data jsonb, -- Array of waypoints
  duration_minutes integer,
  difficulty_level text,
  activities text[],
  weather_conditions jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  rating integer CHECK (rating >= 1 AND rating <= 5)
);

-- Favorite excursions
CREATE TABLE favorite_excursions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  excursion_id uuid REFERENCES excursions(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, excursion_id)
);

-- Enable RLS
ALTER TABLE excursions ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_excursions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own excursions"
  ON excursions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own excursions"
  ON excursions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own excursions"
  ON excursions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 5.2 Excursion Screens
- [ ] Excursion list view
- [ ] Excursion detail view with map
- [ ] Excursion creation flow (via AI assistant)
- [ ] Active excursion tracking
- [ ] Excursion completion and rating

### 5.3 Map Integration
- [ ] Configure react-native-maps with Google Maps provider
- [ ] Add GOOGLE_MAPS_API_KEY to app.json for iOS/Android
- [ ] Configure Google Maps JavaScript API for web
- [ ] Map view component with route display
- [ ] Location permissions handling
- [ ] Current location tracking
- [ ] Waypoint markers and custom pins
- [ ] Route polylines with elevation data
- [ ] Geolocation services integration
- [ ] Map styling to match nature theme

## Phase 6: Voice Interface

### 6.1 Audio Permissions
- [ ] Request microphone permissions
- [ ] Handle permission states (granted, denied, undetermined)
- [ ] User-friendly permission prompts

### 6.2 Voice Components
- [ ] Voice recording button
- [ ] Audio waveform visualization
- [ ] Real-time transcription display
- [ ] Text-to-speech for assistant responses
- [ ] Voice activity detection

### 6.3 Full Duplex Streaming
- [ ] WebSocket connection for real-time audio
- [ ] Audio encoding/decoding
- [ ] Streaming audio to OpenAI
- [ ] Receiving and playing assistant audio
- [ ] Error handling and reconnection logic

## Phase 7: Weather Integration

### 7.1 Weather Edge Function
- [ ] Create weather-api edge function
- [ ] Integrate with OpenWeatherMap API
- [ ] Store OPENWEATHER_API_KEY in Supabase secrets
- [ ] Implement current weather endpoint
- [ ] Implement hourly forecast endpoint (48 hours)
- [ ] Implement daily forecast endpoint (7 days)
- [ ] Return formatted weather data with:
  - Temperature (current, feels like, min/max)
  - Conditions (description, icon)
  - Wind speed and direction
  - Humidity and UV index
  - Precipitation probability
  - Air quality index (if available)
- [ ] Cache weather data (15-30 minutes) to reduce API calls
- [ ] Handle API errors gracefully

### 7.2 Weather Display
- [ ] Weather widget component
- [ ] Current conditions display with icon
- [ ] Temperature and feels-like display
- [ ] Hourly forecast carousel (next 12-24 hours)
- [ ] 7-day forecast for planning
- [ ] Weather alerts/warnings display
- [ ] UV index and air quality indicators
- [ ] Weather-appropriate activity suggestions
- [ ] "Best time to go outside today" recommendation
- [ ] Integration with excursion planning (show weather for excursion location/time)

## Phase 8: Testing & Polish

### 8.1 Testing
- [ ] Test authentication flows
- [ ] Test profile creation and editing
- [ ] Test AI assistant interactions
- [ ] Test excursion creation and tracking
- [ ] Test voice interface
- [ ] Test map integration on iOS
- [ ] Test offline behavior
- [ ] Test error states and edge cases

### 8.2 Polish & UX
- [ ] Loading states for all async operations
- [ ] Error messages that are user-friendly
- [ ] Smooth animations and transitions
- [ ] Haptic feedback (iOS only)
- [ ] Accessibility improvements (VoiceOver support)
- [ ] Performance optimization

### 8.3 Security Audit
- [ ] Verify all RLS policies
- [ ] Ensure no API keys in client code
- [ ] Test authentication edge cases
- [ ] Verify data isolation between users
- [ ] Check for common security vulnerabilities

## Phase 9: iOS Build & Deployment

### 9.1 EAS Build Configuration
- [ ] Configure eas.json for iOS builds
- [ ] Set up build profiles (development, preview, production)
- [ ] Configure app signing
- [ ] Test development build on physical device

### 9.2 TestFlight Deployment
- [ ] Create production build
- [ ] Upload to TestFlight
- [ ] Add internal testers
- [ ] Document testing checklist
- [ ] Gather feedback and iterate

### 9.3 App Store Preparation
- [ ] Create App Store listing (if separate from original app)
- [ ] Prepare screenshots
- [ ] Write app description
- [ ] Set up privacy policy
- [ ] Complete App Store Connect information

## Development Workflow

### Git Workflow
1. Commit frequently with descriptive messages
2. Push to GitHub after each working feature
3. Create branches for major features
4. Keep main branch stable

### Environment Variables
Store in Supabase secrets (accessed by edge functions):
- OPENAI_API_KEY
- OPENWEATHER_API_KEY
- GOOGLE_MAPS_API_KEY (for geocoding/places API in edge functions)

Store in .env (local development only):
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY

Configure in app.json:
- GOOGLE_MAPS_API_KEY (for native iOS/Android maps)

### Build Commands
- `npm run dev` - Start Expo dev server
- `npm run build:web` - Build for web
- `eas build --platform ios` - Build for iOS

## Code Standards

### TypeScript
- Use strict mode
- Define interfaces for all data structures
- Avoid `any` type
- Use proper type guards

### Styling
- Use StyleSheet.create for all styles
- Follow 8px spacing grid
- Use nature color palette consistently
- Ensure text contrast for accessibility

### Components
- One component per file
- Use functional components with hooks
- Extract reusable logic into custom hooks
- Keep components focused and single-purpose

### Database
- All tables have RLS enabled
- Policies are restrictive by default
- Use meaningful column names (snake_case)
- Include created_at and updated_at timestamps

## Success Criteria

- [ ] User can sign up and create profile
- [ ] User can chat with Health Coach assistant
- [ ] User can generate personalized excursions
- [ ] User can view excursions on map (iOS)
- [ ] User can track active excursion
- [ ] User can complete and rate excursions
- [ ] Voice interface works reliably
- [ ] App builds successfully for iOS
- [ ] App is deployed to TestFlight
- [ ] All data is properly secured with RLS

## Notes

- Bundle identifier: `com.natureup.health2` (separate from previous versions)
- This allows parallel testing without affecting existing app
- Focus on iOS first, web is for development preview only
- Voice-first design, text as fallback
- Nature therapy and outdoor wellness is the core focus
- AI assistants provide personalized, context-aware guidance
