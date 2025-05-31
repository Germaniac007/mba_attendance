import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log('script.js: Script started loading.'); // Added log

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDXz19RX48Y8NpsToWAvTHJDi4v2X4nN90",
    authDomain: "mba-calender-a3e30.firebaseapp.com",
    projectId: "mba-calender-a3e30",
    storageBucket: "mba-calender-a3e30.firebasestorage.app",
    messagingSenderId: "984505429191",
    appId: "1:984505429191:web:ede0caefa3bb0c0d7762e2",
    measurementId: "G-KR7J7EQYZ1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Element Variables (declared globally, assigned in DOMContentLoaded) ---
let loginForm, registerForm, resetPasswordForm;
let loginEmail, loginPassword, registerEmail, registerPassword, registerConfirmPassword, resetEmail;
let loginNavBtn, registerNavBtn, calendarNavBtn, dataEntryNavBtn, attendanceLogNavBtn, logoutBtn, currentUserDisplay;
let authPage, calendarPage, dataEntryPage, attendanceLogPage;
let classForm;
let dataEntryClassSubject, dataEntryClassDay, dataEntryTimeSlot, dataEntryRoom, dataEntryFaculty, dataEntryStartDate, dataEntryEndDate;
let classList;
let prevWeekBtn, nextWeekBtn, currentMonthDisplay, calendarGrid, calendarUserSelect, deleteUserDataBtn; // Added deleteUserDataBtn
let popup, closePopupBtn, popupSubject, popupFaculty, popupOriginalDay, popupOriginalTime, popupOriginalRoom, editDate, editTime, editRoom, editAttendance, saveOccurrenceEditBtn, cancelOccurrenceBtn;
let attendanceLogTableBody, attendanceMessage, attendanceLogStartDate, attendanceLogEndDate, generateAttendanceLogBtn;

// --- Global Variables ---
let currentUser = null;
let isAdmin = false;
let currentCalendarMonday = new Date(); // Stores the Monday of the current displayed week
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const timeSlots = [
    '8:30 AM - 10:00 AM', '10:15 AM - 11:45 AM', '12:00 PM - 1:15 PM',
    '2:15 PM - 3:45 PM', '4:00 PM - 5:30 PM', '5:45 PM - 7:15 PM'
];

let classData = []; // To store classes fetched from Firestore
let occurrenceOverrides = {}; // To store occurrence overrides fetched from Firestore

// --- Helper Functions ---

function showPage(pageToShow) {
    console.log('showPage: Attempting to show page:', pageToShow ? pageToShow.id : 'null'); // Added log
    const pages = [authPage, calendarPage, dataEntryPage, attendanceLogPage];
    pages.forEach(page => {
        if (page) { // Check if page element exists
            if (page === pageToShow) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        }
    });
}

function updateNavVisibility() {
    console.log('updateNavVisibility: current user:', currentUser ? currentUser.email : 'none', 'isAdmin:', isAdmin); // Added log
    if (currentUser) {
        if (loginNavBtn) loginNavBtn.style.display = 'none';
        if (registerNavBtn) registerNavBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (currentUserDisplay) currentUserDisplay.textContent = `Welcome, ${currentUser.displayName || currentUser.email}`;

        if (calendarNavBtn) calendarNavBtn.style.display = 'block';
        if (attendanceLogNavBtn) attendanceLogNavBtn.style.display = 'block';
        if (dataEntryNavBtn) dataEntryNavBtn.style.display = 'block'; // Non-admin can also see Data Entry

        if (isAdmin) {
            if (calendarUserSelect) calendarUserSelect.style.display = 'block'; // Admin sees user select
            if (deleteUserDataBtn) deleteUserDataBtn.style.display = 'block'; // Admin sees delete user button
        } else {
            if (calendarUserSelect) calendarUserSelect.style.display = 'none'; // Regular user does not see user select
            if (deleteUserDataBtn) deleteUserDataBtn.style.display = 'none'; // Regular user does not see delete user button
        }
        showPage(calendarPage); // Always default to calendar on login
    } else {
        if (loginNavBtn) loginNavBtn.style.display = 'block';
        if (registerNavBtn) registerNavBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (calendarNavBtn) calendarNavBtn.style.display = 'none';
        if (dataEntryNavBtn) dataEntryNavBtn.style.display = 'none';
        if (attendanceLogNavBtn) attendanceLogNavBtn.style.display = 'none';
        if (currentUserDisplay) currentUserDisplay.textContent = '';
        if (calendarUserSelect) calendarUserSelect.style.display = 'none'; // Hide for logged-out
        if (deleteUserDataBtn) deleteUserDataBtn.style.display = 'none'; // Hide for logged-out
        showPage(authPage);
    }
}

function displayMessage(element, message, isError = false) {
    if (element) {
        element.textContent = message;
        element.style.color = isError ? 'red' : 'green';
        setTimeout(() => element.textContent = '', 5000); // Clear message after 5 seconds
    }
}

function formatDateForInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust if day is Sunday
    return new Date(d.setDate(diff));
}

function populateTimeSlots() {
    console.log('populateTimeSlots: Populating time slots.'); // Added log
    const timeSlotSelects = document.querySelectorAll('#dataEntryTimeSlot, #editTime');
    timeSlotSelects.forEach(select => {
        if (select) { // Ensure select element exists
            select.innerHTML = ''; // Clear existing options
            timeSlots.forEach(slot => {
                const option = document.createElement('option');
                option.value = slot;
                option.textContent = slot;
                select.appendChild(option);
            });
        }
    });
}

function setDefaultDataEntryDates() {
    console.log('setDefaultDataEntryDates: Setting default dates.'); // Added log
    const today = new Date();
    if (dataEntryStartDate) dataEntryStartDate.value = formatDateForInput(today);
    // Set end date to ~3 months from now (approx 90 days)
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(today.getDate() + 90);
    if (dataEntryEndDate) dataEntryEndDate.value = formatDateForInput(ninetyDaysFromNow);

    if (attendanceLogStartDate) attendanceLogStartDate.value = formatDateForInput(today);
    if (attendanceLogEndDate) attendanceLogEndDate.value = formatDateForInput(today);
}

// --- Firebase Authentication ---

async function handleLogin() {
    console.log('handleLogin: Attempting login.'); // Added log
    const email = loginEmail ? loginEmail.value : '';
    const password = loginPassword ? loginPassword.value : '';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle UI update
    } catch (error) {
        displayMessage(loginForm.querySelector('.message'), error.message, true);
        console.error('handleLogin error:', error); // Added log
    }
}

async function handleRegister() {
    console.log('handleRegister: Attempting registration.'); // Added log
    const email = registerEmail ? registerEmail.value : '';
    const password = registerPassword ? registerPassword.value : '';
    const confirmPassword = registerConfirmPassword ? registerConfirmPassword.value : '';

    if (password !== confirmPassword) {
        displayMessage(registerForm.querySelector('.message'), 'Passwords do not match.', true);
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create a user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            createdAt: new Date(),
            // Add any other default user data here
        });

        displayMessage(registerForm.querySelector('.message'), 'Registration successful! You can now log in.', false);
        if (registerForm) registerForm.reset();
        showPage(authPage); // Show login form after successful registration
        if (loginForm) loginForm.classList.add('active'); // Activate login form
        if (registerForm) registerForm.classList.remove('active'); // Deactivate register form

    } catch (error) {
        displayMessage(registerForm.querySelector('.message'), error.message, true);
        console.error('handleRegister error:', error); // Added log
    }
}

async function handlePasswordReset() {
    console.log('handlePasswordReset: Attempting password reset.'); // Added log
    const email = resetEmail ? resetEmail.value : '';
    try {
        await sendPasswordResetEmail(auth, email);
        displayMessage(resetPasswordForm.querySelector('.message'), 'Password reset email sent!', false);
        if (resetPasswordForm) resetPasswordForm.reset();
        showPage(authPage);
        if (loginForm) loginForm.classList.add('active');
        if (resetPasswordForm) resetPasswordForm.classList.remove('active');
    } catch (error) {
        displayMessage(resetPasswordForm.querySelector('.message'), error.message, true);
        console.error('handlePasswordReset error:', error); // Added log
    }
}

function handleLogout() {
    console.log('handleLogout: User logging out.'); // Added log
    signOut(auth);
    // onAuthStateChanged will handle UI update
}

// --- Firestore Data Management ---

async function saveClass(event) {
    console.log('saveClass: Attempting to save class.'); // Added log
    event.preventDefault();

    if (!currentUser) {
        alert('You must be logged in to save classes.');
        return;
    }

    const classData = {
        subject: dataEntryClassSubject ? dataEntryClassSubject.value : '',
        day: dataEntryClassDay ? dataEntryClassDay.value : '',
        time: dataEntryTimeSlot ? dataEntryTimeSlot.value : '',
        room: dataEntryRoom ? dataEntryRoom.value : '',
        faculty: dataEntryFaculty ? dataEntryFaculty.value : '',
        startDate: dataEntryStartDate ? dataEntryStartDate.value : '',
        endDate: dataEntryEndDate ? dataEntryEndDate.value : '',
        createdAt: new Date(),
        createdBy: currentUser.uid // Store who created the class
    };

    try {
        const classesCollectionRef = collection(db, 'users', currentUser.uid, 'classes');
        const saveButton = classForm ? classForm.querySelector('button[type="submit"]') : null;
        const editId = saveButton ? saveButton.dataset.editId : null;

        if (editId) {
            const classDocRef = doc(db, 'users', currentUser.uid, 'classes', editId);
            await updateDoc(classDocRef, classData);
            displayMessage(classForm.querySelector('.message'), 'Class updated successfully!', false);
            if (saveButton) {
                saveButton.textContent = 'Add Class';
                delete saveButton.dataset.editId;
            }
        } else {
            await addDoc(classesCollectionRef, classData);
            displayMessage(classForm.querySelector('.message'), 'Class added successfully!', false);
        }

        if (classForm) classForm.reset();
        populateClassList(); // Refresh the list of classes
    } catch (e) {
        displayMessage(classForm.querySelector('.message'), `Error adding/updating document: ${e.message}`, true);
        console.error('saveClass error:', e); // Added log
    }
}

async function populateClassList() {
    console.log('populateClassList: Populating class list.'); // Added log
    if (!currentUser || !classList) {
        if (classList) classList.innerHTML = '<p>No classes to display.</p>';
        return;
    }

    const classesCollectionRef = collection(db, 'users', currentUser.uid, 'classes');
    const q = query(classesCollectionRef);
    const querySnapshot = await getDocs(q);

    classList.innerHTML = ''; // Clear previous list
    if (querySnapshot.empty) {
        classList.innerHTML = '<p>No classes added yet.</p>';
        return;
    }

    querySnapshot.forEach((docItem) => {
        const data = docItem.data();
        const li = document.createElement('li');
        li.innerHTML = `
            ${data.subject} on ${data.day} at ${data.time} in ${data.room} (Faculty: ${data.faculty})
            <br>
            <small>Term: ${data.startDate} to ${data.endDate}</small>
            <div class="actions">
                <button class="edit-class-btn" data-id="${docItem.id}">Edit</button>
                <button class="delete-class-btn" data-id="${docItem.id}">Delete</button>
            </div>
        `;
        classList.appendChild(li);
    });

    document.querySelectorAll('.edit-class-btn').forEach(button => {
        button.onclick = (e) => editClass(e.target.dataset.id);
    });
    document.querySelectorAll('.delete-class-btn').forEach(button => {
        button.onclick = (e) => deleteClass(e.target.dataset.id);
    });
}

async function editClass(id) {
    console.log('editClass: Editing class with ID:', id); // Added log
    if (!currentUser) return; // Allow non-admin to edit their own classes

    const classDocRef = doc(db, 'users', currentUser.uid, 'classes', id);
    const docSnap = await getDocs(classDocRef); // Use getDocs for a single doc with doc()

    if (docSnap.exists()) {
        const data = docSnap.data();
        if (dataEntryClassSubject) dataEntryClassSubject.value = data.subject;
        if (dataEntryClassDay) dataEntryClassDay.value = data.day;
        if (dataEntryTimeSlot) dataEntryTimeSlot.value = data.time;
        if (dataEntryRoom) dataEntryRoom.value = data.room;
        if (dataEntryFaculty) dataEntryFaculty.value = data.faculty;
        if (dataEntryStartDate) dataEntryStartDate.value = data.startDate;
        if (dataEntryEndDate) dataEntryEndDate.value = data.endDate;

        // Change Save button to Update and set data-id
        const saveButton = classForm ? classForm.querySelector('button[type="submit"]') : null;
        if (saveButton) {
            saveButton.textContent = 'Update Class';
            saveButton.dataset.editId = id;
        }
    }
}

async function deleteClass(id) {
    console.log('deleteClass: Deleting class with ID:', id); // Added log
    if (!currentUser) return; // Allow non-admin to delete their own classes

    if (confirm('Are you sure you want to delete this class? This will also remove associated occurrence overrides.')) {
        try {
            const batch = writeBatch(db);
            const classDocRef = doc(db, 'users', currentUser.uid, 'classes', id);
            batch.delete(classDocRef);

            // Delete associated occurrence overrides
            const occurrencesRef = collection(db, 'users', currentUser.uid, 'occurrences');
            const q = query(occurrencesRef, where('classId', '==', id));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((docItem) => {
                batch.delete(doc(db, 'users', currentUser.uid, 'occurrences', docItem.id));
            });

            await batch.commit();

            displayMessage(classForm.querySelector('.message'), 'Class and its occurrences deleted successfully!', false);
            populateClassList();
            updateCalendarView(); // Refresh calendar after deletion
        } catch (e) {
            displayMessage(classForm.querySelector('.message'), `Error deleting document: ${e.message}`, true);
            console.error('deleteClass error:', e); // Added log
        }
    }
}

// --- User Management (Admin Only) ---
async function deleteUserData() {
    console.log('deleteUserData: Attempting to delete user data.');
    if (!isAdmin) {
        alert('You do not have permission to delete user data.');
        return;
    }

    const userIdToDelete = calendarUserSelect ? calendarUserSelect.value : null;

    if (!userIdToDelete) {
        alert('Please select a user to delete.');
        return;
    }

    if (userIdToDelete === currentUser.uid) {
        alert('You cannot delete your own admin account through this interface. Please use Firebase Console.');
        return;
    }

    const userEmailToDelete = calendarUserSelect ? calendarUserSelect.options[calendarUserSelect.selectedIndex].text : 'selected user';

    if (confirm(`Are you sure you want to permanently delete all data for ${userEmailToDelete}? This action cannot be undone.`)) {
        try {
            const batch = writeBatch(db);

            // 1. Delete all classes for the user
            const classesRef = collection(db, 'users', userIdToDelete, 'classes');
            const classesSnapshot = await getDocs(classesRef);
            classesSnapshot.forEach(docItem => {
                batch.delete(doc(db, 'users', userIdToDelete, 'classes', docItem.id));
            });

            // 2. Delete all occurrence overrides for the user
            const occurrencesRef = collection(db, 'users', userIdToDelete, 'occurrences');
            const occurrencesSnapshot = await getDocs(occurrencesRef);
            occurrencesSnapshot.forEach(docItem => {
                batch.delete(doc(db, 'users', userIdToDelete, 'occurrences', docItem.id));
            });

            // 3. Delete the user's document from the 'users' collection
            const userDocRef = doc(db, 'users', userIdToDelete);
            batch.delete(userDocRef);

            await batch.commit();

            // Note: Deleting the user from Firebase Authentication cannot be done directly client-side for security reasons.
            // In a real application, you'd trigger a Cloud Function or a backend service to handle this.
            // For this client-side example, we'll just remove their Firestore data.
            // A message will inform the admin about the need for manual Auth deletion.
            alert(`User ${userEmailToDelete}'s data has been deleted from Firestore. Please manually delete their account from Firebase Authentication console if desired.`);

            await populateUserSelect(); // Refresh user list
            updateCalendarView(); // Refresh calendar view
        } catch (e) {
            console.error('Error deleting user data:', e);
            alert('Error deleting user data: ' + e.message);
        }
    }
}


// --- Calendar View Functions ---

async function fetchClassesForUser(uid) {
    console.log('fetchClassesForUser: Fetching classes for UID:', uid); // Added log
    if (!uid) {
        console.error("fetchClassesForUser: A valid UID is required.");
        return [];
    }
    const classesCollectionRef = collection(db, 'users', uid, 'classes');
    const q = query(classesCollectionRef);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchOccurrenceOverridesForUser(uid) {
    console.log('fetchOccurrenceOverridesForUser: Fetching overrides for UID:', uid); // Added log
    if (!uid) {
        console.error("fetchOccurrenceOverridesForUser: A valid UID is required.");
        return {};
    }
    const occurrencesCollectionRef = collection(db, 'users', uid, 'occurrences');
    const q = query(occurrencesCollectionRef);
    const querySnapshot = await getDocs(q);
    const overrides = {};
    querySnapshot.forEach(doc => {
        overrides[`${doc.data().classId}-${doc.data().date}`] = doc.data(); // Key by classId and date
    });
    return overrides;
}

async function populateUserSelect() {
    console.log('populateUserSelect: Populating user select dropdown.'); // Added log
    if (!isAdmin || !calendarUserSelect) {
        if (calendarUserSelect) {
            calendarUserSelect.innerHTML = ''; // Ensure it's empty if not admin
            calendarUserSelect.style.display = 'none';
        }
        if (deleteUserDataBtn) deleteUserDataBtn.style.display = 'none';
        return;
    }

    if (calendarUserSelect) {
        calendarUserSelect.style.display = 'block';
        calendarUserSelect.innerHTML = '<option value="">All Users</option>'; // Option to view all users
    }
    if (deleteUserDataBtn) deleteUserDataBtn.style.display = 'block';

    const usersColRef = collection(db, 'users');
    const q = query(usersColRef);
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const option = document.createElement('option');
        option.value = userDoc.id; // Store the UID as the value
        option.textContent = userData.email; // Display email for simplicity
        if (calendarUserSelect) calendarUserSelect.appendChild(option);
    });

    // If an admin is currently logged in, make their UID the default selection.
    // This allows them to easily see their own classes first.
    if (currentUser && isAdmin && calendarUserSelect) {
        const adminOption = Array.from(calendarUserSelect.options).find(option => option.value === currentUser.uid);
        if (adminOption) {
            calendarUserSelect.value = currentUser.uid;
        }
    }
}


async function updateCalendarView() {
    console.log('updateCalendarView: Updating calendar view.'); // Added log
    currentCalendarMonday = getMonday(currentCalendarMonday);
    if (currentMonthDisplay) currentMonthDisplay.textContent = currentCalendarMonday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (calendarGrid) calendarGrid.innerHTML = ''; // Clear previous content

    let classesToDisplay = [];
    let occurrenceOverridesToDisplay = {};

    if (isAdmin) {
        // If admin, check if a specific user is selected in the dropdown
        if (calendarUserSelect && calendarUserSelect.value) {
            const userIdToFetch = calendarUserSelect.value;
            console.log('updateCalendarView: Admin selected user:', userIdToFetch); // Added log
            classesToDisplay = await fetchClassesForUser(userIdToFetch);
            occurrenceOverridesToDisplay = await fetchOccurrenceOverridesForUser(userIdToFetch);
        } else {
            console.log('updateCalendarView: Admin viewing all users.'); // Added log
            const allUsersSnapshot = await getDocs(collection(db, 'users'));
            for (const userDoc of allUsersSnapshot.docs) {
                const userUid = userDoc.id;
                const userData = userDoc.data();
                const userName = userData.name || userData.email;

                const userClassesSnapshot = await getDocs(collection(db, 'users', userUid, 'classes'));
                userClassesSnapshot.forEach(doc => {
                    classesToDisplay.push({ id: doc.id, ...doc.data(), user: userName, userId: userUid });
                });

                const userOccurrencesSnapshot = await getDocs(collection(db, 'users', userUid, 'occurrences'));
                userOccurrencesSnapshot.forEach(doc => {
                    const overrideKey = `${userUid}-${doc.data().classId}-${doc.data().date}`;
                    occurrenceOverridesToDisplay[overrideKey] = { ...doc.data(), userId: userUid };
                });
            }
        }
    } else {
        // For non-admin users, they can only view their own data.
        if (currentUser && currentUser.uid) {
            const userIdToFetch = currentUser.uid;
            console.log('updateCalendarView: Regular user viewing own calendar:', userIdToFetch); // Added log
            classesToDisplay = await fetchClassesForUser(userIdToFetch);
            occurrenceOverridesToDisplay = await fetchOccurrenceOverridesForUser(userIdToFetch);
        } else {
            console.log('updateCalendarView: No current user for calendar view.'); // Added log
        }
    }

    if (calendarGrid) calendarGrid.innerHTML += `<div class="calendar-header"></div>`;

    const weekDates = {};
    for (let i = 0; i < 5; i++) {
        const date = new Date(currentCalendarMonday);
        date.setDate(currentCalendarMonday.getDate() + i);
        const dayName = daysOfWeek[i];
        const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (calendarGrid) calendarGrid.innerHTML += `<div class="calendar-header">${dayName}<br>${displayDate}</div>`;
        weekDates[dayName] = formatDateForInput(date);
    }

    timeSlots.forEach(timeSlot => {
        const timeSlotHeader = document.createElement('div');
        timeSlotHeader.classList.add('time-slot-header');
        timeSlotHeader.textContent = timeSlot;
        if (calendarGrid) calendarGrid.appendChild(timeSlotHeader);

        daysOfWeek.forEach(dayName => {
            const cell = document.createElement('div');
            cell.classList.add('calendar-cell');
            const currentDate = weekDates[dayName];

            classesToDisplay.forEach(cls => {
                const classStartDate = new Date(cls.startDate);
                const classEndDate = new Date(cls.endDate);
                const currentIterationDate = new Date(currentDate);

                if (cls.day === dayName &&
                    cls.time === timeSlot &&
                    currentIterationDate >= classStartDate &&
                    currentIterationDate <= classEndDate) {

                    // The key for occurrence override should include the userId for combined view
                    const occurrenceKey = `${cls.userId || (currentUser ? currentUser.uid : '')}-${cls.id}-${currentDate}`;
                    const override = occurrenceOverridesToDisplay[occurrenceKey];

                    let displayClass = true;
                    let displayRoom = cls.room;
                    let displayTime = cls.time;
                    let displayAttendance = 'N/A';
                    let isCancelled = false;

                    if (override) {
                        displayRoom = override.room || cls.room;
                        displayTime = override.time || cls.time;
                        displayAttendance = override.attendance || 'N/A';
                        isCancelled = override.isCancelled || false;
                        displayClass = !isCancelled;
                    }

                    if (displayClass) {
                        const classDiv = document.createElement('div');
                        classDiv.classList.add('class-entry');
                        if (override && override.room !== cls.room) {
                            classDiv.classList.add('room-changed');
                        }
                        if (override && override.time !== cls.time) {
                            classDiv.classList.add('time-changed');
                        }
                        if (isCancelled) {
                            classDiv.classList.add('cancelled');
                        }

                        let userDisplay = '';
                        if (isAdmin && (calendarUserSelect && !calendarUserSelect.value)) { // Only show user name if "All Users" is selected
                            userDisplay = `<span class="class-user">${cls.user}: </span>`;
                        }

                        classDiv.innerHTML = `
                            ${userDisplay}
                            <strong>${cls.subject}</strong><br>
                            Room: ${displayRoom}<br>
                            Faculty: ${cls.faculty}<br>
                            Attendance: ${displayAttendance}
                        `;
                        classDiv.dataset.classId = cls.id;
                        classDiv.dataset.date = currentDate;
                        classDiv.dataset.originalDay = cls.day;
                        classDiv.dataset.originalTime = cls.time;
                        classDiv.dataset.originalRoom = cls.room;
                        classDiv.dataset.subject = cls.subject;
                        classDiv.dataset.faculty = cls.faculty;
                        // Always store the userId for proper lookup in the popup
                        classDiv.dataset.userId = cls.userId || (currentUser ? currentUser.uid : '');
                        classDiv.dataset.occurrenceId = override ? override.id : null;
                        classDiv.dataset.isCancelled = isCancelled;

                        classDiv.onclick = (e) => openPopup(e.currentTarget);
                        cell.appendChild(classDiv);
                    }
                }
            });
            if (calendarGrid) calendarGrid.appendChild(cell);
        });
    });
}

function openPopup(classDiv) {
    console.log('openPopup: Opening popup for class:', classDiv.dataset.subject); // Added log
    if (!popup) return;
    popup.style.display = 'block';

    const classId = classDiv.dataset.classId;
    const date = classDiv.dataset.date;
    const originalDay = classDiv.dataset.originalDay;
    const originalTime = classDiv.dataset.originalTime;
    const originalRoom = classDiv.dataset.originalRoom;
    const subject = classDiv.dataset.subject;
    const faculty = classDiv.dataset.faculty;
    const userId = classDiv.dataset.userId; // Get userId from dataset
    const isCancelled = classDiv.dataset.isCancelled === 'true';

    if (popupSubject) popupSubject.textContent = subject;
    if (popupFaculty) popupFaculty.textContent = faculty;
    if (popupOriginalDay) popupOriginalDay.textContent = originalDay;
    if (popupOriginalTime) popupOriginalTime.textContent = originalTime;
    if (popupOriginalRoom) popupOriginalRoom.textContent = originalRoom;

    if (editDate) editDate.value = date;
    if (editRoom) editRoom.value = originalRoom;
    if (editTime) editTime.value = originalTime;
    if (editAttendance) editAttendance.value = 'NA';

    const occurrenceKey = `${userId}-${classId}-${date}`; // Use userId in key
    const existingOverride = occurrenceOverrides[occurrenceKey];

    if (existingOverride) {
        if (editDate) editDate.value = existingOverride.date || date;
        if (editRoom) editRoom.value = existingOverride.room || originalRoom;
        if (editTime) editTime.value = existingOverride.time || originalTime;
        if (editAttendance) editAttendance.value = existingOverride.attendance || 'NA';
        if (cancelOccurrenceBtn) {
            if (existingOverride.isCancelled) {
                cancelOccurrenceBtn.textContent = 'Uncancel Class';
                cancelOccurrenceBtn.dataset.isCancelled = 'true';
            } else {
                cancelOccurrenceBtn.textContent = 'Cancel Class';
                cancelOccurrenceBtn.dataset.isCancelled = 'false';
            }
        }
    } else {
        if (cancelOccurrenceBtn) {
            cancelOccurrenceBtn.textContent = 'Cancel Class';
            cancelOccurrenceBtn.dataset.isCancelled = 'false';
        }
    }

    // Only allow editing if the current user is the owner of the class or is an admin.
    const canEdit = currentUser && (currentUser.uid === userId || isAdmin);

    if (saveOccurrenceEditBtn) {
        saveOccurrenceEditBtn.dataset.classId = classId;
        saveOccurrenceEditBtn.dataset.originalDate = date;
        saveOccurrenceEditBtn.dataset.userId = userId;
        saveOccurrenceEditBtn.dataset.occurrenceId = existingOverride ? existingOverride.id : null; // Pass occurrence ID if exists
        saveOccurrenceEditBtn.style.display = canEdit ? 'block' : 'none';
    }

    if (cancelOccurrenceBtn) {
        cancelOccurrenceBtn.dataset.classId = classId;
        cancelOccurrenceBtn.dataset.originalDate = date;
        cancelOccurrenceBtn.dataset.userId = userId;
        cancelOccurrenceBtn.dataset.occurrenceId = existingOverride ? existingOverride.id : null; // Pass occurrence ID if exists
        cancelOccurrenceBtn.style.display = canEdit ? 'block' : 'none';
    }

    if (editDate) editDate.disabled = !canEdit;
    if (editTime) editTime.disabled = !canEdit;
    if (editRoom) editRoom.disabled = !canEdit;
    if (editAttendance) editAttendance.disabled = !canEdit;
}

async function saveOccurrenceEdit() {
    console.log('saveOccurrenceEdit: Saving occurrence edit.'); // Added log
    if (!saveOccurrenceEditBtn) return;
    const classId = saveOccurrenceEditBtn.dataset.classId;
    const originalDate = saveOccurrenceEditBtn.dataset.originalDate;
    const userId = saveOccurrenceEditBtn.dataset.userId;
    const occurrenceId = saveOccurrenceEditBtn.dataset.occurrenceId; // Retrieve occurrenceId

    const updatedDate = editDate ? editDate.value : '';
    const updatedTime = editTime ? editTime.value : '';
    const updatedRoom = editRoom ? editRoom.value : '';
    const updatedAttendance = editAttendance ? editAttendance.value : '';

    // Check if the current user is authorized to edit this occurrence
    if (!(currentUser && (currentUser.uid === userId || isAdmin))) {
        alert('You do not have permission to edit this class occurrence.');
        return;
    }

    const overrideData = {
        classId: classId,
        date: updatedDate,
        time: updatedTime,
        room: updatedRoom,
        attendance: updatedAttendance,
        isCancelled: false // Assume not cancelled when saving edits
    };

    try {
        const occurrencesCollectionRef = collection(db, 'users', userId, 'occurrences');
        if (occurrenceId && occurrenceId !== 'null') {
            const occurrenceDocRef = doc(db, 'users', userId, 'occurrences', occurrenceId);
            await updateDoc(occurrenceDocRef, overrideData);
        } else {
            // Check if an override already exists for this classId and date
            const q = query(
                occurrencesCollectionRef,
                where('classId', '==', classId),
                where('date', '==', originalDate)
            );
            const existingOverridesSnapshot = await getDocs(q);

            if (!existingOverridesSnapshot.empty) {
                const existingOverrideDoc = existingOverridesSnapshot.docs[0];
                await updateDoc(doc(db, 'users', userId, 'occurrences', existingOverrideDoc.id), overrideData);
            } else {
                await addDoc(occurrencesCollectionRef, overrideData);
            }
        }
        alert('Occurrence updated successfully!');
        if (popup) popup.style.display = 'none';
        updateCalendarView();
    } catch (e) {
        console.error("Error saving occurrence edit: ", e);
        alert('Error saving changes: ' + e.message);
    }
}

async function cancelOccurrence() {
    console.log('cancelOccurrence: Toggling class cancellation.'); // Added log
    if (!cancelOccurrenceBtn) return;
    const classId = cancelOccurrenceBtn.dataset.classId;
    const originalDate = cancelOccurrenceBtn.dataset.originalDate;
    const userId = cancelOccurrenceBtn.dataset.userId;
    const occurrenceId = cancelOccurrenceBtn.dataset.occurrenceId;
    const wasCancelled = cancelOccurrenceBtn.dataset.isCancelled === 'true';

    // Check if the current user is authorized to cancel this occurrence
    if (!(currentUser && (currentUser.uid === userId || isAdmin))) {
        alert('You do not have permission to cancel this class occurrence.');
        return;
    }

    const confirmAction = wasCancelled ? 'Are you sure you want to uncancel this class?' : 'Are you sure you want to cancel this class?';

    if (confirm(confirmAction)) {
        try {
            const occurrencesCollectionRef = collection(db, 'users', userId, 'occurrences');
            const overrideData = {
                classId: classId,
                date: originalDate,
                isCancelled: !wasCancelled,
                // When cancelling/uncancelling, we might also want to reset attendance,
                // but for now, we'll just toggle cancellation status.
                attendance: 'N/A' // Reset attendance on cancel/uncancel
            };

            if (occurrenceId && occurrenceId !== 'null') {
                const occurrenceDocRef = doc(db, 'users', userId, 'occurrences', occurrenceId);
                await updateDoc(occurrenceDocRef, overrideData);
            } else {
                const q = query(
                    occurrencesCollectionRef,
                    where('classId', '==', classId),
                    where('date', '==', originalDate)
                );
                const existingOverridesSnapshot = await getDocs(q);

                if (!existingOverridesSnapshot.empty) {
                    const existingOverrideDoc = existingOverridesSnapshot.docs[0];
                    await updateDoc(doc(db, 'users', userId, 'occurrences', existingOverrideDoc.id), overrideData);
                } else {
                    // Only add a new override if it's being cancelled for the first time
                    if (!wasCancelled) {
                        await addDoc(occurrencesCollectionRef, overrideData);
                    }
                }
            }

            alert(wasCancelled ? 'Class uncanceled successfully!' : 'Class cancelled successfully!');
            if (popup) popup.style.display = 'none';
            updateCalendarView();
        } catch (e) {
            console.error("Error toggling class cancellation: ", e);
            alert('Error toggling cancellation: ' + e.message);
        }
    }
}

// --- Attendance Log Functions ---

async function generateAttendanceLog() {
    console.log('generateAttendanceLog: Generating attendance log.'); // Added log
    if (!currentUser || !attendanceMessage || !attendanceLogTableBody) {
        if (attendanceMessage) attendanceMessage.textContent = 'Please log in to generate attendance log.';
        if (attendanceMessage) attendanceMessage.style.display = 'block';
        return;
    }

    let userIdForLog = currentUser.uid;
    let userDisplayNameForLog = currentUser.displayName || currentUser.email;

    // Admin can select a user; otherwise, it's the current user.
    if (isAdmin && calendarUserSelect && calendarUserSelect.value) {
        userIdForLog = calendarUserSelect.value;
        userDisplayNameForLog = calendarUserSelect.options[calendarUserSelect.selectedIndex].text;
    } else if (isAdmin && (!calendarUserSelect || !calendarUserSelect.value)) {
        // If admin but "All Users" is selected, default to admin's own attendance for this view.
        // It's generally not practical to show a combined attendance log for all users.
        userIdForLog = currentUser.uid;
        userDisplayNameForLog = currentUser.displayName || currentUser.email;
        if (attendanceMessage) {
            attendanceMessage.textContent = "Attendance log currently shows your own classes. Select a specific user from the calendar dropdown to view their attendance.";
            attendanceMessage.style.display = 'block';
        }
    }

    const startDate = attendanceLogStartDate ? new Date(attendanceLogStartDate.value) : null;
    const endDate = attendanceLogEndDate ? new Date(attendanceLogEndDate.value) : null;

    if (!startDate || isNaN(startDate) || !endDate || isNaN(endDate)) {
        if (attendanceMessage) attendanceMessage.textContent = 'Please select valid start and end dates.';
        if (attendanceMessage) attendanceMessage.style.display = 'block';
        return;
    }
    if (attendanceMessage) attendanceMessage.style.display = 'none';

    attendanceLogTableBody.innerHTML = '';

    const classesColRef = collection(db, 'users', userIdForLog, 'classes');
    const classesSnapshot = await getDocs(classesColRef);
    const userClasses = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const occurrencesColRef = collection(db, 'users', userIdForLog, 'occurrences');
    const occurrencesSnapshot = await getDocs(occurrencesColRef);
    const userOccurrences = {};
    occurrencesSnapshot.forEach(doc => {
        userOccurrences[`${doc.data().classId}-${doc.data().date}`] = doc.data();
    });

    const attendanceSummary = {};

    userClasses.forEach(cls => {
        if (!attendanceSummary[cls.subject]) {
            attendanceSummary[cls.subject] = { total: 0, attended: 0, missed: 0 };
        }

        const classStartDate = new Date(cls.startDate);
        const classEndDate = new Date(cls.endDate);

        let loopDate = new Date(startDate);
        while (loopDate <= endDate) {
            const dayName = daysOfWeek[loopDate.getDay() === 0 ? 6 : loopDate.getDay() - 1]; // Adjust for Sunday (0) to be last day
            const formattedDate = formatDateForInput(loopDate);
            const occurrenceKey = `${cls.id}-${formattedDate}`;
            const override = userOccurrences[occurrenceKey];

            if (cls.day === dayName && loopDate >= classStartDate && loopDate <= classEndDate) {
                let attendanceStatus = 'N/A';
                let isCancelled = false;

                if (override) {
                    attendanceStatus = override.attendance || 'N/A';
                    isCancelled = override.isCancelled || false;
                }

                if (!isCancelled) {
                    attendanceSummary[cls.subject].total++;
                    if (attendanceStatus === 'Yes') {
                        attendanceSummary[cls.subject].attended++;
                    } else if (attendanceStatus === 'No') {
                        attendanceSummary[cls.subject].missed++;
                    }
                }
            }
            loopDate.setDate(loopDate.getDate() + 1);
        }
    });

    const sortedSubjects = Object.keys(attendanceSummary).sort();

    if (sortedSubjects.length === 0) {
        if (attendanceMessage) {
            attendanceMessage.textContent = 'No classes found or scheduled for this user within the selected date range.';
            attendanceMessage.style.display = 'block';
        }
        return;
    }

    sortedSubjects.forEach(subjectName => {
        const data = attendanceSummary[subjectName];
        const leeway = Math.max(0, 4 - data.missed); // Assuming 4 missed classes leeway

        const row = attendanceLogTableBody.insertRow();
        if (row) {
            row.insertCell().textContent = subjectName;
            row.insertCell().textContent = data.total;
            row.insertCell().textContent = data.attended;
            row.insertCell().textContent = data.missed;
            row.insertCell().textContent = leeway;
        }
    });
}


// --- Initializations and Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded: DOM content fully loaded.'); // Added log

    // Assign DOM elements AFTER the DOM is fully loaded
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    resetPasswordForm = document.getElementById('resetPasswordForm');
    loginEmail = document.getElementById('loginEmail');
    loginPassword = document.getElementById('loginPassword');
    registerEmail = document.getElementById('registerEmail');
    registerPassword = document.getElementById('registerPassword');
    registerConfirmPassword = document.getElementById('registerConfirmPassword');
    resetEmail = document.getElementById('resetEmail');
    loginNavBtn = document.getElementById('loginNavBtn');
    registerNavBtn = document.getElementById('registerNavBtn');
    calendarNavBtn = document.getElementById('calendarNavBtn');
    dataEntryNavBtn = document.getElementById('dataEntryNavBtn');
    attendanceLogNavBtn = document.getElementById('attendanceLogNavBtn');
    logoutBtn = document.getElementById('logoutBtn');
    currentUserDisplay = document.getElementById('currentUserDisplay');
    authPage = document.getElementById('authPage');
    calendarPage = document.getElementById('calendarPage');
    dataEntryPage = document.getElementById('dataEntryPage');
    attendanceLogPage = document.getElementById('attendanceLogPage');
    classForm = document.getElementById('classForm');
    dataEntryClassSubject = document.getElementById('dataEntryClassSubject');
    dataEntryClassDay = document.getElementById('dataEntryClassDay');
    dataEntryTimeSlot = document.getElementById('dataEntryTimeSlot');
    dataEntryRoom = document.getElementById('dataEntryRoom');
    dataEntryFaculty = document.getElementById('dataEntryFaculty');
    dataEntryStartDate = document.getElementById('dataEntryStartDate');
    dataEntryEndDate = document.getElementById('dataEntryEndDate');
    classList = document.getElementById('classList');
    prevWeekBtn = document.getElementById('prevWeekBtn');
    nextWeekBtn = document.getElementById('nextWeekBtn');
    currentMonthDisplay = document.getElementById('currentMonthDisplay');
    calendarGrid = document.getElementById('calendarGrid');
    calendarUserSelect = document.getElementById('calendarUserSelect');
    deleteUserDataBtn = document.getElementById('deleteUserDataBtn'); // Assigned new button
    popup = document.getElementById('popup');
    closePopupBtn = document.getElementById('closePopupBtn');
    popupSubject = document.getElementById('popupSubject');
    popupFaculty = document.getElementById('popupFaculty');
    popupOriginalDay = document.getElementById('popupOriginalDay');
    popupOriginalTime = document.getElementById('popupOriginalTime');
    popupOriginalRoom = document.getElementById('popupOriginalRoom');
    editDate = document.getElementById('editDate');
    editTime = document.getElementById('editTime');
    editRoom = document.getElementById('editRoom');
    editAttendance = document.getElementById('editAttendance');
    saveOccurrenceEditBtn = document.getElementById('saveOccurrenceEditBtn');
    cancelOccurrenceBtn = document.getElementById('cancelOccurrenceBtn');
    attendanceLogTableBody = document.getElementById('attendanceLogTableBody');
    attendanceMessage = document.getElementById('attendanceMessage');
    attendanceLogStartDate = document.getElementById('attendanceLogStartDate');
    attendanceLogEndDate = document.getElementById('attendanceLogEndDate');
    generateAttendanceLogBtn = document.getElementById('generateAttendanceLogBtn');

    console.log('DOMContentLoaded: All DOM elements assigned.'); // Added log

    // Now that elements are assigned, safely call initializers
    populateTimeSlots();
    setDefaultDataEntryDates();


    // Navigation Event Listeners
    if (loginNavBtn) loginNavBtn.addEventListener('click', () => {
        console.log('loginNavBtn clicked.'); // Added log
        showPage(authPage);
        if (loginForm) loginForm.classList.add('active');
        if (registerForm) registerForm.classList.remove('active');
        if (resetPasswordForm) resetPasswordForm.classList.remove('active');
    });
    if (registerNavBtn) registerNavBtn.addEventListener('click', () => {
        console.log('registerNavBtn clicked.'); // Added log
        showPage(authPage);
        if (registerForm) registerForm.classList.add('active');
        if (loginForm) loginForm.classList.remove('active');
        if (resetPasswordForm) resetPasswordForm.classList.remove('active');
    });
    if (calendarNavBtn) calendarNavBtn.addEventListener('click', () => { console.log('calendarNavBtn clicked.'); showPage(calendarPage); }); // Added log
    if (dataEntryNavBtn) dataEntryNavBtn.addEventListener('click', () => { console.log('dataEntryNavBtn clicked.'); showPage(dataEntryPage); }); // Added log
    if (attendanceLogNavBtn) attendanceLogNavBtn.addEventListener('click', () => { console.log('attendanceLogNavBtn clicked.'); showPage(attendanceLogPage); }); // Added log
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Auth Forms Event Listeners
    if (loginForm) loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
    });
    if (registerForm) registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleRegister();
    });
    if (resetPasswordForm) resetPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handlePasswordReset();
    });
    const showRegisterFormBtn = document.getElementById('showRegisterForm');
    if (showRegisterFormBtn) showRegisterFormBtn.addEventListener('click', () => {
        console.log('showRegisterFormBtn clicked.'); // Added log
        if (loginForm) loginForm.classList.remove('active');
        if (registerForm) registerForm.classList.add('active');
        if (resetPasswordForm) resetPasswordForm.classList.remove('active');
    });
    const showLoginFormBtn = document.getElementById('showLoginForm');
    if (showLoginFormBtn) showLoginFormBtn.addEventListener('click', () => {
        console.log('showLoginFormBtn clicked.'); // Added log
        if (registerForm) registerForm.classList.remove('active');
        if (loginForm) loginForm.classList.add('active');
        if (resetPasswordForm) resetPasswordForm.classList.remove('active');
    });
    const showResetPasswordFormBtn = document.getElementById('showResetPasswordForm');
    if (showResetPasswordFormBtn) showResetPasswordFormBtn.addEventListener('click', () => {
        console.log('showResetPasswordFormBtn clicked.'); // Added log
        if (loginForm) loginForm.classList.remove('active');
        if (registerForm) registerForm.classList.remove('active');
        if (resetPasswordForm) resetPasswordForm.classList.add('active');
    });

    // Data Entry Form
    if (classForm) classForm.addEventListener('submit', saveClass);

    // Calendar Navigation
    if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => {
        console.log('prevWeekBtn clicked.'); // Added log
        currentCalendarMonday.setDate(currentCalendarMonday.getDate() - 7);
        updateCalendarView();
    });
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => {
        console.log('nextWeekBtn clicked.'); // Added log
        currentCalendarMonday.setDate(currentCalendarMonday.getDate() + 7);
        updateCalendarView();
    });
    if (calendarUserSelect) calendarUserSelect.addEventListener('change', () => {
        console.log('calendarUserSelect changed.'); // Added log
        updateCalendarView(); // Re-render calendar when admin selects a user
    });
    if (deleteUserDataBtn) deleteUserDataBtn.addEventListener('click', deleteUserData); // New: Event listener for delete user data

    // Popup
    if (closePopupBtn) closePopupBtn.addEventListener('click', () => {
        console.log('closePopupBtn clicked.'); // Added log
        if (popup) popup.style.display = 'none';
    });
    if (saveOccurrenceEditBtn) saveOccurrenceEditBtn.addEventListener('click', saveOccurrenceEdit);
    if (cancelOccurrenceBtn) cancelOccurrenceBtn.addEventListener('click', cancelOccurrence);

    // Attendance Log
    if (generateAttendanceLogBtn) generateAttendanceLogBtn.addEventListener('click', generateAttendanceLog);
});

// Auth state listener (kept outside DOMContentLoaded as it's a Firebase SDK event)
onAuthStateChanged(auth, async (user) => {
    console.log('onAuthStateChanged: Auth state changed. User:', user ? user.email : 'null'); // Added log
    currentUser = user;
    isAdmin = user && user.email === 'admin@example.com';
    updateNavVisibility();

    if (currentUser) {
        await populateUserSelect();
        await updateCalendarView(); // Ensure this is awaited to fetch data before rendering
        populateClassList(); // Populate for all users
        await generateAttendanceLog(); // Ensure this is awaited
    }
    console.log('onAuthStateChanged: End of auth state processing.'); // Added log
});