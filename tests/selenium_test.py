"""
TaskFlow - Selenium WebDriver end-to-end test suite.

Usage:
    python tests/selenium_test.py                         # tests http://localhost
    python tests/selenium_test.py http://<alb-dns-name>   # tests the AWS Load Balancer
    python tests/selenium_test.py http://<alb-dns> --headed  # watch the browser

Each step saves a screenshot to tests/screenshots/ as evidence.
"""
import os
import sys
import time
import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE_URL = (ARGS[0] if ARGS else os.environ.get("BASE_URL", "http://localhost")).rstrip("/")
HEADLESS = "--headed" not in sys.argv
SCREENSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")

RUN_ID = str(int(time.time()))[-6:]
USERNAME = f"selenium_{RUN_ID}"
PASSWORD = "Selenium@123"
TASK_TITLE = f"Selenium task {RUN_ID}"


class TaskFlowE2ETest(unittest.TestCase):
    """Tests run in order (test_01, test_02, ...) and share one browser session."""

    @classmethod
    def setUpClass(cls):
        options = webdriver.ChromeOptions()
        if HEADLESS:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1366,900")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        cls.driver = webdriver.Chrome(options=options)  # Selenium Manager finds chromedriver
        cls.wait = WebDriverWait(cls.driver, 15)
        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        print(f"\nTesting {BASE_URL} as user '{USERNAME}'\n")

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    # ---------- helpers ----------
    def shot(self, name):
        self.driver.save_screenshot(os.path.join(SCREENSHOT_DIR, f"{name}.png"))

    def find(self, by, value):
        return self.wait.until(EC.visibility_of_element_located((by, value)))

    def click(self, by, value):
        self.wait.until(EC.element_to_be_clickable((by, value))).click()

    def task_item(self, title):
        xpath = f"//li[contains(@class,'task')][.//div[@class='task-title' and text()='{title}']]"
        return self.find(By.XPATH, xpath)

    # ---------- tests ----------
    def test_01_home_page_loads(self):
        """Open the app and verify title and login form elements."""
        self.driver.get(BASE_URL + "/")
        self.assertIn("TaskFlow", self.driver.title)
        self.assertEqual(self.find(By.ID, "app-title").text, "TaskFlow")
        self.assertTrue(self.find(By.ID, "login-form").is_displayed())
        self.shot("01_home_page")

    def test_02_register_new_user(self):
        """Register a new account through the Register tab."""
        self.click(By.ID, "tab-register")
        self.find(By.ID, "reg-fullname").send_keys("Selenium Bot")
        self.find(By.ID, "reg-username").send_keys(USERNAME)
        self.find(By.ID, "reg-password").send_keys(PASSWORD)
        self.shot("02_register_form")
        self.click(By.ID, "register-btn")
        self.wait.until(EC.url_contains("/tasks.html"))
        self.assertEqual(self.find(By.ID, "page-heading").text, "My Tasks")

    def test_03_logout_and_login(self):
        """Log out, check a wrong password is rejected, then log in correctly."""
        self.click(By.ID, "logout-btn")
        self.wait.until(EC.url_contains("/index.html"))

        self.find(By.ID, "login-username").send_keys(USERNAME)
        self.find(By.ID, "login-password").send_keys("wrong-password")
        self.click(By.ID, "login-btn")
        error = self.wait.until(EC.text_to_be_present_in_element((By.ID, "login-error"), "Invalid"))
        self.assertTrue(error)

        pwd = self.find(By.ID, "login-password")
        pwd.clear()
        pwd.send_keys(PASSWORD)
        self.click(By.ID, "login-btn")
        self.wait.until(EC.url_contains("/tasks.html"))
        self.assertIn("Selenium Bot", self.find(By.ID, "nav-username").text)
        self.shot("03_logged_in")

    def test_04_create_task(self):
        """Fill the Add Task form and submit."""
        self.find(By.ID, "task-title").send_keys(TASK_TITLE)
        self.find(By.ID, "task-desc").send_keys("Created automatically by Selenium WebDriver")
        Select(self.find(By.ID, "task-priority")).select_by_value("high")
        self.find(By.ID, "task-category").send_keys("Testing")
        self.click(By.ID, "add-task-btn")
        self.wait.until(EC.text_to_be_present_in_element((By.ID, "task-list"), TASK_TITLE))

    def test_05_verify_task_in_list(self):
        """Verify the new task element and its badges are shown."""
        item = self.task_item(TASK_TITLE)
        self.assertIn("priority-high", item.get_attribute("class"))
        self.assertEqual(item.find_element(By.CLASS_NAME, "task-status").text.lower(), "pending")
        self.assertIn("Testing", item.text)
        self.shot("05_task_created")

    def test_06_mark_done_and_filter(self):
        """Tick the checkbox, then filter by status = Done."""
        self.task_item(TASK_TITLE).find_element(By.CLASS_NAME, "task-toggle").click()
        self.wait.until(lambda d: "done" in self.task_item(TASK_TITLE).get_attribute("class"))

        Select(self.find(By.ID, "filter-status")).select_by_value("done")
        self.wait.until(lambda d: all(
            s.text.lower() == "done" for s in d.find_elements(By.CLASS_NAME, "task-status")))
        self.assertTrue(self.task_item(TASK_TITLE).is_displayed())
        self.shot("06_filtered_done")

    def test_07_dashboard_stats(self):
        """Dashboard shows 1 task, 1 completed, 100%."""
        self.click(By.ID, "nav-dashboard")
        self.wait.until(EC.text_to_be_present_in_element((By.ID, "stat-total"), "1"))
        self.assertEqual(self.find(By.ID, "stat-done").text, "1")
        self.assertEqual(self.find(By.ID, "stat-rate").text, "100%")
        self.shot("07_dashboard")

    def test_08_server_info(self):
        """Server Info page shows which server answered and DB is connected."""
        self.click(By.ID, "nav-info")
        name = self.wait.until(lambda d: d.find_element(By.ID, "server-name").text not in ("", "…")
                               and d.find_element(By.ID, "server-name").text)
        self.assertIn("connected", self.find(By.ID, "db-info").text)
        print(f"   served by: {name}")
        self.shot("08_server_info")

    def test_09_delete_task(self):
        """Delete the task (accept the confirm dialog) and verify it is gone."""
        self.click(By.ID, "nav-tasks")
        self.task_item(TASK_TITLE).find_element(By.CLASS_NAME, "task-delete").click()
        self.wait.until(EC.alert_is_present()).accept()
        self.find(By.ID, "empty-state")
        self.assertNotIn(TASK_TITLE, self.find(By.ID, "task-list").text)
        self.shot("09_task_deleted")

    def test_10_logout(self):
        """Logout returns to the login page and protected pages redirect."""
        self.click(By.ID, "logout-btn")
        self.wait.until(EC.url_contains("/index.html"))
        self.driver.get(BASE_URL + "/tasks.html")
        self.wait.until(EC.url_contains("/index.html"))
        self.assertTrue(self.find(By.ID, "login-form").is_displayed())
        self.shot("10_logged_out")


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TaskFlowE2ETest)
    result = unittest.TextTestRunner(verbosity=2, failfast=True).run(suite)
    passed = result.testsRun - len(result.failures) - len(result.errors)
    print("\n" + "=" * 50)
    print(f" SELENIUM RESULT: {passed}/{result.testsRun} passed -> "
          f"{'PASS' if result.wasSuccessful() else 'FAIL'}")
    print(f" Screenshots: {SCREENSHOT_DIR}")
    print("=" * 50)
    sys.exit(0 if result.wasSuccessful() else 1)
