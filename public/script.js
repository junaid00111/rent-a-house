const defaultProperties = [
    {
        id: 'default-1',
        title: 'Luxury Apartment',
        location: 'Banjara Hills, Hyderabad',
        price: 25000,
        type: 'Apartment',
        image: 'images/aparts.jpg',
    },
    {
        id: 'default-2',
        title: 'Modern Villa',
        location: 'Jubilee Hills, Hyderabad',
        price: 45000,
        type: 'Villa',
        image: 'images/villas.jpg',
    },
    {
        id: 'default-3',
        title: 'Cozy Flat',
        location: 'Gachibowli, Hyderabad',
        price: 18000,
        type: 'Flat',
        image: 'images/flats.jpg',
    },
];

let authMode = 'login';
let currentUser = null;
let activeProperties = [];
let allProperties = [];
let userBookings = [];
let ownerBookings = [];

function formatContactNumber(contactNumber) {
    return contactNumber ? `Contact: ${contactNumber}` : '';
}

const authPage = document.getElementById('authPage');
const dashboardPage = document.getElementById('dashboardPage');
const authForm = document.getElementById('authForm');
const authKicker = document.getElementById('authKicker');
const authTitle = document.getElementById('authTitle');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const authHint = document.getElementById('authHint');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('passwordToggle');
const logoutBtn = document.getElementById('logoutBtn');
const userTools = document.getElementById('userTools');
const ownerTools = document.getElementById('ownerTools');
const searchForm = document.getElementById('searchForm');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const propertyForm = document.getElementById('propertyForm');
const propertyMessage = document.getElementById('propertyMessage');
const propertiesTitle = document.getElementById('propertiesTitle');
const emptyProperties = document.getElementById('emptyProperties');
const profileSection = document.getElementById('profileSection');
const ownerPropertiesGrid = document.getElementById('ownerPropertiesGrid');
const emptyOwnerProperties = document.getElementById('emptyOwnerProperties');
const ownerPropertyCount = document.getElementById('ownerPropertyCount');
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const dashboardSections = document.querySelectorAll('.dashboard-section');
const userNavItems = document.querySelectorAll('.user-nav');
const ownerNavItems = document.querySelectorAll('.owner-nav');
const bookingsGrid = document.getElementById('bookingsGrid');
const emptyBookings = document.getElementById('emptyBookings');
const ownerBookingsGrid = document.getElementById('ownerBookingsGrid');
const emptyOwnerBookings = document.getElementById('emptyOwnerBookings');
const ownerBookingMessage = document.getElementById('ownerBookingMessage');
const bookingMessage = document.getElementById('bookingMessage');

function setAuthMode(mode) {
    authMode = mode;
    const isRegister = mode === 'register';

    authForm.classList.toggle('register-mode', isRegister);
    loginTab.classList.toggle('active', !isRegister);
    registerTab.classList.toggle('active', isRegister);
    authKicker.textContent = isRegister ? 'Start fresh' : 'Welcome back';
    authTitle.textContent = isRegister ? 'Create your account' : 'Log in to continue';
    submitBtn.textContent = isRegister ? 'Create account' : 'Login';
    authHint.textContent = isRegister
        ? 'Already have an account? Choose login to continue.'
        : 'New here? Choose create account to get started.';
    message.textContent = '';
    message.classList.remove('success');
}

function getFormData() {
    return {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: passwordInput.value,
        role: document.getElementById('role').value,
    };
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    const data = await response.json();

    if (!response.ok) {
        const help = data.help ? ` ${data.help}` : '';
        throw new Error(`${data.message || 'Request failed'}${help}`);
    }

    return data;
}

function formatPrice(price) {
    return `Rs ${Number(price).toLocaleString('en-IN')}/month`;
}

function showSection(sectionId) {
    dashboardSections.forEach((section) => {
        section.classList.toggle('active', section.id === sectionId);
        section.classList.toggle('hidden', section.id !== sectionId);
    });

    sidebarLinks.forEach((link) => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });
}

function readImageFile(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve('');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the selected photo.'));
        reader.readAsDataURL(file);
    });
}

async function submitAuth(event) {
    event.preventDefault();

    const formData = getFormData();
    const isRegister = authMode === 'register';

    message.textContent = '';
    message.classList.remove('success');

    if ((isRegister && !formData.name) || !formData.email || !formData.password) {
        message.textContent = 'Please fill all required fields.';
        return;
    }

    if (formData.password.length < 6) {
        message.textContent = 'Password must be at least 6 characters.';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = isRegister ? 'Creating account...' : 'Logging in...';

    try {
        const endpoint = isRegister ? '/api/register' : '/api/login';
        const body = isRegister
            ? formData
            : { email: formData.email, password: formData.password };
        const data = await requestJson(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        localStorage.setItem('rahUser', JSON.stringify(data.user));
        await showDashboard(data.user);
    } catch (error) {
        message.textContent = error.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isRegister ? 'Create account' : 'Login';
    }
}

async function showDashboard(user) {
    currentUser = user;
    authPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
    document.getElementById('welcomeText').textContent = `Welcome, ${user.name}`;
    document.getElementById('roleText').textContent = user.role === 'owner' ? 'Owner' : 'User';
    await loadProperties();
    await loadBookings();
    updateDashboardForRole(user);
    activeProperties = allProperties;
    renderProperties(activeProperties);
    renderBookings();
    showSection('overviewSection');
}

function showAuth() {
    dashboardPage.classList.add('hidden');
    authPage.classList.remove('hidden');
}

function updateDashboardForRole(user) {
    const isOwner = user.role === 'owner';

    userNavItems.forEach((item) => item.classList.toggle('hidden', isOwner));
    ownerNavItems.forEach((item) => item.classList.toggle('hidden', !isOwner));

    document.getElementById('roleSummary').textContent = isOwner
        ? 'Add rental properties and manage your listings.'
        : 'Search properties and continue your home search.';
    document.getElementById('statOneLabel').textContent = isOwner ? 'Your Listings' : 'Saved Searches';
    document.getElementById('statOneValue').textContent = isOwner
        ? allProperties.filter((property) => property.ownerId === user.id).length
        : '3';
    document.getElementById('statOneText').textContent = isOwner
        ? 'Properties you added to your account.'
        : 'Hyderabad homes matching your latest preferences.';
    document.getElementById('statTwoLabel').textContent = isOwner ? 'Views' : 'Bookings';
    document.getElementById('statTwoValue').textContent = isOwner ? ownerBookings.length : userBookings.length;
    document.getElementById('statTwoText').textContent = isOwner
        ? 'Booking requests tenants have made on your listings.'
        : 'Properties you booked from the search page.';
    propertiesTitle.textContent = isOwner ? 'Properties visible to users' : 'Start with these places';

    renderProfile(user);
    renderOwnerProperties(user);
    renderOwnerBookings();
}

function renderProfile(user) {
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileContact').textContent = `Contact: ${user.email}`;
    document.getElementById('profileRole').textContent = user.role === 'owner' ? 'Owner' : 'User';
}

function renderOwnerProperties(user) {
    const ownerProperties = allProperties.filter((property) => property.ownerId === user.id);

    ownerPropertyCount.textContent = ownerProperties.length;
    emptyOwnerProperties.classList.toggle('hidden', ownerProperties.length > 0);
    ownerPropertiesGrid.innerHTML = ownerProperties
        .map((property) => `
            <article class="owner-property">
                <img src="${property.image}" alt="${property.title}">
                <div>
                    <h4>${property.title}</h4>
                    <p>${property.location}</p>
                    ${property.contactNumber ? `<p>${formatContactNumber(property.contactNumber)}</p>` : ''}
                    <span class="property-meta">${property.type}</span>
                    <div class="property-price">${formatPrice(property.price)}</div>
                    <button class="secondary-btn delete-property-btn" data-property-id="${property.id}" type="button">Delete Property</button>
                </div>
            </article>
        `)
        .join('');
}

async function loadProperties() {
    const data = await requestJson('/api/properties');
    allProperties = [...defaultProperties, ...data.properties];
}

async function loadBookings() {
    if (!currentUser) {
        userBookings = [];
        ownerBookings = [];
        return;
    }

    if (currentUser.role === 'user') {
        const data = await requestJson(`/api/bookings?userId=${encodeURIComponent(currentUser.id)}`);
        userBookings = data.bookings;
        ownerBookings = [];
        return;
    }

    const data = await requestJson(`/api/bookings?ownerId=${encodeURIComponent(currentUser.id)}`);
    ownerBookings = data.bookings;
    userBookings = [];
}

function renderProperties(propertiesToRender) {
    const grid = document.getElementById('propertiesGrid');
    emptyProperties.classList.toggle('hidden', propertiesToRender.length > 0);
    grid.innerHTML = propertiesToRender
        .map((property) => `
            <article class="property-card">
                <img src="${property.image}" alt="${property.title}">
                <div class="property-content">
                    <h3>${property.title}</h3>
                    <p>${property.location}</p>
                    ${property.contactNumber ? `<p>${formatContactNumber(property.contactNumber)}</p>` : ''}
                    <span class="property-meta">${property.type}</span>
                    <div class="property-price">${formatPrice(property.price)}</div>
                    ${
                        currentUser && currentUser.role === 'user'
                            ? `<button class="secondary-btn book-btn" data-property-id="${property.id}" type="button">Book Now</button>`
                            : ''
                    }
                </div>
            </article>
        `)
        .join('');
}

function renderBookings() {
    emptyBookings.classList.toggle('hidden', userBookings.length > 0);
    bookingsGrid.innerHTML = userBookings
        .map((booking) => `
            <article class="property-card">
                <img src="${booking.property.image}" alt="${booking.property.title}">
                <div class="property-content">
                    <h3>${booking.property.title}</h3>
                    <p>${booking.property.location}</p>
                    ${booking.property.contactNumber ? `<p>${formatContactNumber(booking.property.contactNumber)}</p>` : ''}
                    <span class="property-meta">${booking.status}</span>
                    <div class="property-price">${formatPrice(booking.property.price)}</div>
                    <p>Booked on ${booking.bookedAt}</p>
                    ${
                        booking.status === 'Accepted' || booking.status === 'Rejected'
                            ? `<button class="secondary-btn delete-booking-btn" data-booking-id="${booking.id}" type="button">Delete Booking</button>`
                            : ''
                    }
                </div>
            </article>
        `)
        .join('');
}

function renderOwnerBookings() {
    emptyOwnerBookings.classList.toggle('hidden', ownerBookings.length > 0);
    ownerBookingsGrid.innerHTML = ownerBookings
        .map((booking) => `
            <article class="property-card">
                <img src="${booking.property.image}" alt="${booking.property.title}">
                <div class="property-content">
                    <h3>${booking.property.title}</h3>
                    <p>${booking.property.location}</p>
                    <p>Tenant: ${booking.tenantName || 'Unknown tenant'}</p>
                    <p>Email: ${booking.tenantEmail || 'Not available'}</p>
                    <span class="property-meta">${booking.status}</span>
                    <div class="property-price">${formatPrice(booking.property.price)}</div>
                    <p>Booked on ${booking.bookedAt}</p>
                    ${
                        booking.status === 'Pending'
                            ? `
                                <button class="primary-btn booking-action-btn" data-booking-id="${booking.id}" data-status="Accepted" type="button">Accept</button>
                                <button class="secondary-btn booking-action-btn" data-booking-id="${booking.id}" data-status="Rejected" type="button">Reject</button>
                            `
                            : ''
                    }
                </div>
            </article>
        `)
        .join('');
}

function searchProperties(event) {
    event.preventDefault();

    const location = document.getElementById('searchLocation').value.trim().toLowerCase();
    const budget = Number(document.getElementById('searchBudget').value);
    const type = document.getElementById('searchType').value;

    activeProperties = allProperties.filter((property) => {
        const matchesLocation = !location || property.location.toLowerCase().includes(location);
        const matchesBudget = !budget || property.price <= budget;
        const matchesType = !type || property.type === type;
        return matchesLocation && matchesBudget && matchesType;
    });

    renderProperties(activeProperties);
}

function clearSearch() {
    searchForm.reset();
    activeProperties = allProperties;
    renderProperties(activeProperties);
}

async function addProperty(event) {
    event.preventDefault();

    const title = document.getElementById('propertyTitle').value.trim();
    const location = document.getElementById('propertyLocation').value.trim();
    const price = Number(document.getElementById('propertyPrice').value);
    const type = document.getElementById('propertyType').value;
    const contactNumber = document.getElementById('propertyContact').value.trim();
    const photo = document.getElementById('propertyPhoto').files[0];

    propertyMessage.textContent = '';

    if (!title || !location || !price || !contactNumber) {
        propertyMessage.textContent = 'Please fill the property title, location, price, and contact number.';
        return;
    }

    const imagesByType = {
        Apartment: 'images/aparts.jpg',
        Villa: 'images/villas.jpg',
        Flat: 'images/flats.jpg',
        House: 'images/villas.jpg',
    };
    try {
        const uploadedImage = await readImageFile(photo);
        const newProperty = {
            title,
            location,
            price,
            type,
            image: uploadedImage || imagesByType[type],
            ownerId: currentUser.id,
            ownerName: currentUser.name,
            contactNumber,
        };

        await requestJson('/api/properties', {
            method: 'POST',
            body: JSON.stringify(newProperty),
        });
        propertyForm.reset();
        propertyMessage.textContent = 'Property added successfully.';
        await loadProperties();
        updateDashboardForRole(currentUser);
        activeProperties = allProperties;
        renderProperties(activeProperties);
        renderOwnerProperties(currentUser);
    } catch (error) {
        propertyMessage.textContent = error.message;
    }
}

async function bookProperty(propertyId) {
    const property = allProperties.find((item) => item.id === propertyId);

    if (!property || !currentUser) return;

    try {
        await requestJson('/api/bookings', {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id,
                tenantName: currentUser.name,
                tenantEmail: currentUser.email,
                property,
            }),
        });
        await loadBookings();
        updateDashboardForRole(currentUser);
        renderBookings();
        showSection('bookingsSection');
    } catch (error) {
        alert(error.message);
    }
}

async function deleteProperty(propertyId) {
    if (!currentUser || currentUser.role !== 'owner') return;

    const property = allProperties.find((item) => item.id === propertyId && item.ownerId === currentUser.id);

    if (!property) {
        propertyMessage.textContent = 'Property not found.';
        return;
    }

    const shouldDelete = window.confirm(`Delete "${property.title}"? This will also remove its bookings.`);

    if (!shouldDelete) {
        return;
    }

    propertyMessage.textContent = '';

    try {
        await requestJson(`/api/properties/${encodeURIComponent(propertyId)}?ownerId=${encodeURIComponent(currentUser.id)}`, {
            method: 'DELETE',
        });
        propertyMessage.textContent = 'Property deleted successfully.';
        await loadProperties();
        await loadBookings();
        updateDashboardForRole(currentUser);
        activeProperties = allProperties;
        renderProperties(activeProperties);
        renderOwnerProperties(currentUser);
        renderBookings();
        renderOwnerBookings();
    } catch (error) {
        propertyMessage.textContent = error.message;
    }
}

async function updateBookingStatus(bookingId, status) {
    if (!currentUser || currentUser.role !== 'owner') return;

    ownerBookingMessage.textContent = '';

    try {
        await requestJson(`/api/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                ownerId: currentUser.id,
                status,
            }),
        });
        ownerBookingMessage.textContent = `Booking ${status.toLowerCase()} successfully.`;
        await loadBookings();
        updateDashboardForRole(currentUser);
        renderOwnerBookings();
    } catch (error) {
        ownerBookingMessage.textContent = error.message;
    }
}

async function deleteBooking(bookingId) {
    if (!currentUser || currentUser.role !== 'user') return;

    bookingMessage.textContent = '';

    try {
        await requestJson(`/api/bookings/${encodeURIComponent(bookingId)}?userId=${encodeURIComponent(currentUser.id)}`, {
            method: 'DELETE',
        });
        bookingMessage.textContent = 'Booking deleted successfully.';
        await loadBookings();
        updateDashboardForRole(currentUser);
        renderBookings();
    } catch (error) {
        bookingMessage.textContent = error.message;
    }
}

loginTab.addEventListener('click', () => setAuthMode('login'));
registerTab.addEventListener('click', () => setAuthMode('register'));
authForm.addEventListener('submit', submitAuth);
searchForm.addEventListener('submit', searchProperties);
clearSearchBtn.addEventListener('click', clearSearch);
propertyForm.addEventListener('submit', addProperty);

sidebarLinks.forEach((link) => {
    link.addEventListener('click', () => showSection(link.dataset.section));
});

document.getElementById('propertiesGrid').addEventListener('click', (event) => {
    const button = event.target.closest('.book-btn');
    if (button) {
        bookProperty(button.dataset.propertyId);
    }
});

bookingsGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.delete-booking-btn');
    if (button) {
        deleteBooking(button.dataset.bookingId);
    }
});

ownerPropertiesGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.delete-property-btn');
    if (button) {
        deleteProperty(button.dataset.propertyId);
    }
});

ownerBookingsGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.booking-action-btn');
    if (button) {
        updateBookingStatus(button.dataset.bookingId, button.dataset.status);
    }
});

passwordToggle.addEventListener('click', () => {
    const shouldShow = passwordInput.type === 'password';
    passwordInput.type = shouldShow ? 'text' : 'password';
    passwordToggle.textContent = shouldShow ? 'Hide' : 'Show';
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('rahUser');
    authForm.reset();
    setAuthMode('login');
    showAuth();
});

const savedUser = JSON.parse(localStorage.getItem('rahUser') || 'null');
if (savedUser) {
    showDashboard(savedUser);
} else {
    setAuthMode('login');
    showAuth();
}
